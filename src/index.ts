import { LogReaderController } from "./controllers/LogReader";

(async function main() {
	const body = document.body;

	const controller = new LogReaderController

	body.replaceChildren(controller.getContainer());
})();
