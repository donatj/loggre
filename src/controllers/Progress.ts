import { AbstractBaseController } from "../AbstractController";

export interface ProgressHandler {
	start(total: number): void;
	progress(numerator: number, denominator: number): Promise<void>;
	finish(): void;
}

export class Progressbar extends AbstractBaseController<HTMLProgressElement> implements ProgressHandler {

	constructor() {
		let elm = document.createElement("progress");
		elm.value = 0;
		elm.max = 100;
		elm.style.width = "100%";
		elm.style.visibility = "hidden";

		super("progressbar", elm);
	}

	public start(total: number) {
		this.container.value = 0;
		this.container.max = total;
		this.container.style.visibility = "";
	}

	public async progress(numerator: number, denominator: number) {
		this.container.value = numerator;
		this.container.max = denominator;

		await new Promise(requestAnimationFrame);
	}

	public finish() {
		this.container.value = this.container.max;
		this.container.style.visibility = "hidden";
	}

}
