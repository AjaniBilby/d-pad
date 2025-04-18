class Vec2 {
	x: number; // +right
	y: number; // +down

	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
	}

	length2 () {
		return this.x*this.x + this.y*this.y;
	}
	length () {
		return Math.sqrt(this.length2());
	}

	abs() {
		this.x = Math.abs(this.x);
		this.y = Math.abs(this.y);

		return this;
	}

	transpose() {
		const t = this.x;
		this.x = this.y;
		this.y = t;

		return this;
	}

	invert () {
		this.x = -this.x;
		this.y = -this.y;

		return this;
	}

	scale(scalar: number): Vec2 {
		this.x *= scalar;
		this.y *= scalar;
		return this;
	}

	div(scalar: number): Vec2 {
		this.x /= scalar;
		this.y /= scalar;

		return this;
	}

	to (other: Vec2): Vec2 {
		this.x -= other.x;
		this.y -= other.y;
		return this;
	}

	equal(other: Vec2) {
		if (this.x !== other.x) return false;
		if (this.y !== other.y) return false;
		return true;
	}

	dot (other: Vec2) {
		return this.x * other.x + this.y * other.y;
	}

	copy () {
		return new Vec2(this.x, this.y);
	}

	toString() {
		return `vec2{${this.x}, ${this.y}}`;
	}

	static blank = new Vec2(0,0);
}

class Rect {
	tl: Vec2; // top-left
	br: Vec2; // bottom-right

	constructor(a: Vec2, b: Vec2) {
		this.tl = new Vec2(
			Math.min(a.x, b.x),
			Math.min(a.y, b.y),
		);
		this.br = new Vec2(
			Math.max(a.x, b.x),
			Math.max(a.y, b.y),
		);
	}

	overlaps(other: Rect) {
		const x = this.tl.x < other.br.x && other.tl.x < this.br.x;
		const y = this.tl.y < other.br.y && other.tl.y < this.br.y;
		return x && y;
	}

	center(): Vec2 {
		const d = this.size();
		d.scale(0.5);

		return new Vec2(this.tl.x + d.x, this.tl.y + d.x);
	}

	size(): Vec2 {
		return new Vec2(
			this.br.x-this.tl.x,
			this.br.y-this.tl.y,
		);
	}

	/**
	 * The shortest vector to travel between non-overlapping rectangles
	 * If overlapping, is the vector between Rect.center()s
	 */
	vector(other: Rect): Vec2 {
		let dx = 0;
		if (other.br.x < this.tl.x) {
			dx = other.br.x - this.tl.x;
		} else if (this.br.x < other.tl.x) {
			dx = other.tl.x - this.br.x;
		}

		let dy = 0;
		if (other.br.y < this.tl.y) {
			dy = other.br.y - this.tl.y;
		} else if (this.br.y < other.tl.y) {
			dy = other.tl.y - this.br.y;
		}

		if (dx === 0 && dy === 0) return other.center().to(this.center());

		return new Vec2(dx, dy);
	}

	toString() {
		return `rect{ ${this.tl}, ${this.br} }`;
	}

	static blank = new Rect(Vec2.blank, Vec2.blank);
}

function GetBounds(element: Element): Rect {
	if (!element) return Rect.blank;

	if (!element.isConnected) console.warn("GetBounds: Element might not be rendered or connected to the DOM.", element);

	const rect = element.getBoundingClientRect();

	const tl = new Vec2(rect.left, rect.top);
	const br = new Vec2(rect.right, rect.bottom);

	return new Rect(tl, br);
}


let groupFocus = null as null | { element: HTMLElement, from: Rect, dir: Vec2 };

function Move(focus: HTMLElement, dir: Vec2): boolean {
	const scope = GetGroup(focus);
	const best = NearestElement(focus, dir, GroupElements(scope, focus));
	const from = GetBounds(focus);

	if (best) {
		if (best.classList.contains("dp-group")) groupFocus = { element: best, dir, from };
		else groupFocus = null;

		best.focus();
		return true;
	}

	if (scope != document.body) {
		groupFocus = { element: scope, dir: dir.invert(), from };
		scope.focus();
		return true;
	}

	if (groupFocus) groupFocus.dir = dir;

	return false;
}

function NearestElement(target: HTMLElement, dir: Vec2, group: ReturnType<typeof GroupElements>): HTMLElement | null {
	const cursor = GetBounds(target);
	const position = cursor.center();

	const best = {
		alignment: 0,
		distance:  Infinity,
		element:   null as HTMLElement | null,
		skew:      Infinity
	};

	for (const element of group) {
		const bounds = GetBounds(element);
		if (bounds.overlaps(cursor)) continue;

		const d = cursor.vector(bounds);

		const distance = d.length2();
		d.div(distance);

		const alignment = dir.dot(d);
		if (alignment === 0) continue;

		if (alignment < best.alignment) continue;
		if (distance  > best.distance) continue;

		const offset = bounds.center().to(position);

		const axis = dir.copy().transpose().abs();
		const skew = axis.dot(offset);
		if (alignment === best.alignment && distance == best.distance) {
			if (skew > best.skew) continue;
		}

		best.element   = element;
		best.alignment = alignment;
		best.distance  = distance;
		best.skew      = skew;
	}

	return best?.element;
}



function EnterGroup(focus: NonNullable<typeof groupFocus>) {
	const best = {
		distance:  Infinity,
		element:   null as HTMLElement | null,
	};

	for (const element of GroupElements(focus.element)) {
		const bounds = GetBounds(element);
		const offset = bounds.vector(focus.from);
		const distance = offset.length2();

		if (distance > best.distance) continue;

		best.element   = element;
		best.distance  = distance;
	}

	if (!best.element) return false;

	best.element.focus();
	return true;
}

function GetGroup(e: HTMLElement) {
	const r = e.parentElement?.closest(".dp-group");
	if (r instanceof HTMLElement) return r;
	return document.body;
}

function* GroupElements(scope: HTMLElement, ignore?: HTMLElement) {
	const elements = scope.querySelectorAll('input, textarea, select, button, a, *[tabindex], audio, video, summary');

	for (const element of elements) {
		if (element === scope)  continue;
		if (element === ignore) continue;
		if (!(element instanceof HTMLElement)) continue;
		if (element.classList.contains("dp-ignore")) continue;
		if (element.classList.contains("dp-disable")) continue;
		if (GetGroup(element) != scope) continue;

		if (element.hasAttribute("disabled")) continue;

		const style = window.getComputedStyle(element);
		if (style.display === "none") continue;
		if (style.visibility === "hidden") continue;

		yield element;
	}
}


function CheckRule(element: HTMLElement, on: string, off: string) {
	if (element.classList.contains(on))  return true;
	if (element.classList.contains(off)) return false;

	const parent = element.closest(`.${on}, .${off}`);
	if (!parent) return false;

	if (parent.classList.contains(on))  return true;
	if (parent.classList.contains(off)) return false;

	return false;
}


document.addEventListener("keydown", (ev) => {
	const focus = document.activeElement;
	if (!focus || !(focus instanceof HTMLElement)) return;

	if (!CheckRule(focus, "dp-enable", "dp-disable")) return false;

	const block = HandleKey(ev, focus);
	if (block) ev.preventDefault();

	if (ev.key !== " ") return;
	if (focus instanceof HTMLDivElement || focus instanceof HTMLLabelElement) {
		ev.preventDefault();
		focus.click();
		return false;
	}
});

function HandleKey(ev: KeyboardEvent, focus: HTMLElement): boolean {
	if (groupFocus && ev.key === " ") return EnterGroup(groupFocus);

	if (focus instanceof HTMLInputElement) {
		switch (ev.key) {
			case "ArrowRight": {
				if (focus.selectionStart != focus.value.length) return false;
				return Move(focus, DIRECTION.right.copy())
			}
			case "ArrowLeft": {
				if (focus.selectionStart != 0) return false;
				return Move(focus, DIRECTION.left.copy());
			}
			case "ArrowUp":   return Move(focus, DIRECTION.up.copy());
			case "ArrowDown": return Move(focus, DIRECTION.down.copy());
			case "Backspace": return Backspace(focus);
			default: {
				const isPotentiallyAddingChar = ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey;
				if (isPotentiallyAddingChar) {
					if (!focus.maxLength || focus.maxLength === -1) return false;
					if (focus.value.length < focus.maxLength) return false;

					if (AutoFlow(focus, true)) return false; // don't consume the input
				}
			}
		}

		return false;
	}

	if (focus instanceof HTMLSelectElement) {
		switch (ev.key) {
			case "ArrowRight": return Move(focus, DIRECTION.right.copy());
			case "ArrowLeft":  return Move(focus, DIRECTION.left.copy());
			case "ArrowUp": {
				if (focus.selectedIndex != 0) return false;
				return Move(focus, DIRECTION.up.copy())
			}
			case "ArrowDown": {
				if (focus.selectedIndex != focus.options.length-1) return false;
				return Move(focus, DIRECTION.down.copy());
			}
		}

		return false;
	}

	if (focus instanceof HTMLTextAreaElement) {
		switch (ev.key) {
			case "ArrowRight": {
				const pos = GetTextAreaPosition(focus);
				if (pos.col !== pos.cols) return false;
				return Move(focus, DIRECTION.right.copy());
			}
			case "ArrowLeft": {
				const pos = GetTextAreaPosition(focus);
				if (pos.col !== 0) return false;
				return Move(focus, DIRECTION.left.copy());
			}
			case "ArrowUp": {
				const pos = GetTextAreaPosition(focus);
				if (pos.line !== 0) return false;

				return Move(focus, DIRECTION.up.copy());
			}
			case "ArrowDown": {
				const pos = GetTextAreaPosition(focus);
				if (pos.line != pos.lines) return false;

				return Move(focus, DIRECTION.down.copy());
			}
			case "Backspace": return Backspace(focus);
		}

		return false;
	}

	const dir = GetKeyDirection(ev.key);
	if (!dir) return false;

	return Move(focus, dir);
}

function Backspace(focus: HTMLInputElement | HTMLTextAreaElement) {
	setTimeout(() => {
		if (focus.value.length !== 0) return;
		AutoFlow(focus, false);
	}, 0);

	return false; // don't consume input
}


function GetTextAreaPosition(input: HTMLTextAreaElement) {
	let col = 0;
	let line = 0;

	for (let i=0; i<input.selectionStart; i++) {
		if (input.value[i] === "\n") {
			col = 0;
			line++;
			continue;
		}
		col++;
	}

	let lines = line;
	for (let i=input.selectionStart; i<input.value.length; i++) {
		if (input.value[i] === "\n") lines++;
	}

	let cols = input.value.indexOf("\n", input.selectionStart);
	if (cols === -1) cols = input.value.length - input.selectionStart + col;
	else {
		cols = cols - input.selectionStart + col;
	}

	return { line, col, cols, lines };
}


export const DIRECTION = {
	up:    new Vec2( 0, -1),
	down:  new Vec2( 0,  1),
	left:  new Vec2(-1,  0),
	right: new Vec2( 1,  0),
}
Object.freeze(DIRECTION);
Object.freeze(DIRECTION.up);
Object.freeze(DIRECTION.down);
Object.freeze(DIRECTION.left);
Object.freeze(DIRECTION.right);

function GetKeyDirection(key: string) {
	if (!key.startsWith("Arrow")) return null;
	const d = DIRECTION[key.slice("Arrow".length).toLowerCase() as keyof typeof DIRECTION];
	if (!d) return null;

	return d.copy();
}


export const autoFlow = {
	next: [ DIRECTION.right, DIRECTION.down ],
	back: [ DIRECTION.left,  DIRECTION.up ],
}

function AutoFlow(focus: HTMLElement, forward: boolean) {
	if (!CheckRule(focus, "dp-flow-auto", "dp-flow-strict")) return false;

	const moves = forward ? autoFlow.next : autoFlow.back;
	for (const move of moves) if (Move(focus, move.copy())) return true; // try move

	return false;
}