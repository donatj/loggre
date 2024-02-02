import { LogReaderController } from "./controllers/LogReader";

(async function main() {
	const body = document.body;
	console.log("body: ", body);

	const controller = new LogReaderController

	body.replaceChildren(controller.getContainer());
})();
