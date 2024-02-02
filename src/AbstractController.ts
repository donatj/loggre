
export interface ControllerInterface<T extends HTMLElement> {
	// attach(elm: HTMLElement): void;
	getContainer(): T;
}

export abstract class AbstractBaseController<T extends HTMLElement> implements ControllerInterface<T> {
	constructor(protected container: T, protected name: string) {
		this.container.classList.add(`${name}--controller`);
	}

	// public attach(elm: HTMLElement): void {
	// 	elm.appendChild(this.container);
	// }

	// public detach(elm: HTMLElement): boolean {
	// 	try {
	// 		elm.removeChild(this.container);
	// 	} catch (e) {
	// 		return false;
	// 	}

	// 	return true;
	// }

	public getContainer() {
		return this.container;
	}

}

