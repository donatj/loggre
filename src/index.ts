import { LogReaderController } from "./controllers/LogReader";

export function init(attachTo: HTMLElement) {
	const controller = new LogReaderController;
	attachTo.replaceChildren(controller.getContainer());
};
