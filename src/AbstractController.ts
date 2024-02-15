export interface ControllerInterface<T extends HTMLElement = HTMLElement> {
	// attach(elm: HTMLElement): void;
	getContainer(): HTMLElement;
}

export abstract class AbstractBaseController<T extends HTMLElement = HTMLElement> implements ControllerInterface<T> {

	protected container: T;

	constructor(
		private name: string,
		container: T|keyof HTMLElementTagNameMap = "div",
	) {
		if (typeof container === "string") {
			this.container = document.createElement(container) as T;
		} else {
			this.container = container;
		}

		this.container.classList.add(`${this.name}--controller`);
	}

	public getContainer() {
		return this.container;
	}

}

export function labelFor(label: string, input: HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement) {
	if (input.id === "") {
		input.id = makeUniqueId();
	}

	let labelElm = document.createElement("label");
	labelElm.textContent = label;
	labelElm.htmlFor = input.id;

	return [labelElm, input];
}

export function makeUniqueId() {
	return "id-" + Math.random().toString(36).substring(2) + "-" + Date.now().toString(36);
}
