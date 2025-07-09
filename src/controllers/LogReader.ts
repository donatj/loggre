import { AbstractBaseController, labelFor } from "../AbstractController";
import { PhpErrorLog } from "../logtypes/php-error";
import { getAllLogs, ProgressHandler } from "../io";
import { applyFilter, AfterFilter, AndFilter, BeforeFilter, LogEntry, LogFilter, LogType } from "../logtypes/Logs";
import { Progressbar } from "./Progress";

class LogDetailsDialog extends AbstractBaseController<HTMLDialogElement> {

	private output = (() => {
		let elm = document.createElement("output");
		elm.classList.add("details-output");
		elm.style.whiteSpace = "pre-wrap";

		return elm;
	})();

	private hideButton = (() => {
		let elm = document.createElement("button");
		elm.textContent = "Close";

		return elm;
	})();

	constructor() {
		super("details-dialog", document.createElement("dialog"));

		this.container.append(
			this.hideButton,
			this.output
		);

		this.hideButton.addEventListener("click", () => {
			this.container.close();
		});

		this.getContainer().addEventListener("click", (e) => {
			if (e.target === this.container) {
				this.container.close();
			}
		});
	}

	public showDetails(entry: LogEntry) {
		this.output.textContent = entry.getRawEntry();
		this.container.showModal();
	}

}

class LogReaderProgressHandler implements ProgressHandler {
	constructor(
		public readonly fieldset: HTMLFieldSetElement,
		public readonly progressbar: Progressbar
	) { }

	start(total: number) {
		this.fieldset.disabled = true;
		this.progressbar.start(total);
	}

	progress(numerator: number, denominator: number) {
		return this.progressbar.progress(numerator, denominator);
	}

	finish() {
		this.fieldset.disabled = false;
		this.progressbar.finish();
	}
}


export class LogReaderController extends AbstractBaseController {

	private uploadButton = (() => {
		let elm = document.createElement("input");
		elm.type = "file";
		elm.multiple = true;

		return elm;
	})();

	private groupers = (() => {
		let elm = document.createElement("textarea");

		elm.value = localStorage.getItem("groupers") ?? "";
		elm.addEventListener("input", () => {
			localStorage.setItem("groupers", elm.value);
		});

		return elm;
	})();

	private exclusions = (() => {
		let elm = document.createElement("textarea");

		elm.value = localStorage.getItem("exclusions") ?? "";
		elm.addEventListener("input", () => {
			localStorage.setItem("exclusions", elm.value);
		});

		return elm;
	})();

	private inclusions = (() => {
		let elm = document.createElement("textarea");

		elm.value = localStorage.getItem("inclusions") ?? "";
		elm.addEventListener("input", () => {
			localStorage.setItem("inclusions", elm.value);
		});

		return elm;
	})();

	private startTime = (() => {
		let elm = document.createElement("input");
		elm.type = "datetime-local";

		elm.value = localStorage.getItem("startTime") ?? "";
		elm.addEventListener("input", () => {
			localStorage.setItem("startTime", elm.value);
		});

		return elm;
	})();

	private endTime = (() => {
		let elm = document.createElement("input");
		elm.type = "datetime-local";

		elm.value = localStorage.getItem("endTime") ?? "";
		elm.addEventListener("input", () => {
			localStorage.setItem("endTime", elm.value);
		});

		return elm;
	})();

	private runButton = (() => {
		let elm = document.createElement("button");
		elm.textContent = "Run";
		elm.disabled = true;

		return elm;
	})();

	private logItemOutput = (() => {
		let elm = document.createElement("output");
		elm.classList.add("log-item-output");
		elm.style.whiteSpace = "pre-wrap";

		return elm;
	})();

	private maxLogSelect = (() => {
		let elm = document.createElement("select");
		elm.innerHTML = `
			<option>100</option>
			<option>1000</option>
			<option selected>10000</option>
			<option>100000</option>
			<option>1000000</option>
			<option value="all">All</option>
		`;

		return elm;
	})();

	private progressHandler = new LogReaderProgressHandler(document.createElement("fieldset"), new Progressbar);

	private detailsDialog = new LogDetailsDialog;

	constructor() {
		super("log-reader", "main");

		const logType = new PhpErrorLog;

		let fieldset = this.progressHandler.fieldset;

		fieldset.append(
			this.uploadButton,
			document.createElement("br"),
			...labelFor("Exclusions", this.exclusions),
			...labelFor("Inclusions", this.inclusions),
			...labelFor("Groupers", this.groupers),
			...labelFor("Start time", this.startTime),
			...labelFor("End time", this.endTime),
			...labelFor("Max logs", this.maxLogSelect),
			this.progressHandler.progressbar.getContainer(),
			this.runButton
		);

		this.container.append(
			fieldset,
			this.logItemOutput,
			this.detailsDialog.getContainer()
		);

		this.uploadButton.addEventListener("change", () => {
			this.runButton.disabled = !this.uploadButton.files?.length;
		});

		this.runButton.addEventListener("click", async () => {
			let maxLogs = Infinity;
			if (this.maxLogSelect.value !== "all") {
				maxLogs = Number(this.maxLogSelect.value);
			}

			fieldset.disabled = true;

			let filter = makeLogFilter(
				matchers(this.inclusions.value),
				matchers(this.exclusions.value)
			);

			const start = this.startTime.value ? new Date(this.startTime.value) : null;
			if (start) {
				filter = AndFilter(filter, AfterFilter(start));
			}

			const end = this.endTime.value ? new Date(this.endTime.value) : null;
			if (end) {
				filter = AndFilter(filter, BeforeFilter(end));
			}

			const files = Array.from(this.uploadButton.files ?? []);
			await this.renderLog(files, logType, filter, matchers(this.groupers.value), this.logItemOutput, maxLogs, this.detailsDialog, this.progressHandler);
			fieldset.disabled = false;
		});
	}

	private async renderLog(
		files: File[],
		logType: LogType,
		filter: LogFilter,
		groupers: Matcher[],
		outputElm: HTMLOutputElement,
		maxLogs: number,
		detailsDialog: LogDetailsDialog,
		progress: ProgressHandler,
	) {
		let ungrouped = 0;

		outputElm.innerHTML = "";

		progress.start(files.length);

		const groups = groupers.map(g => new LogItemGroupController(g));
		for (const gmi of groups) {
			gmi.getContainer().addEventListener("click", async () => {
				await this.renderLog(files, logType, makeLogFilter([gmi.matcher], []), [], this.logItemOutput, maxLogs, this.detailsDialog, this.progressHandler);
			});

			outputElm.append(gmi.getContainer());
		}

		const logs = applyFilter(getAllLogs(files, logType, progress), filter);

		for await (const logEntry of logs) {
			const logItemController = new LogItemController(logEntry, detailsDialog);

			const log = logEntry.getRawEntry();
			let matched = false;
			for (const g of groups) {
				if (g.matches(log)) {
					g.log(logItemController);
					matched = true;
					break;
				}
			}

			if (!matched) {
				ungrouped++;
				outputElm.append(logItemController.getContainer());
			}

			if (ungrouped > maxLogs) {
				break;
			}
		}

		progress.finish();
	}
}

class LogItemGroupController extends AbstractBaseController {

	private title = document.createElement("h1");

	private firstLog: LogItemController | null = null;

	private seen = 0;

	constructor(
		public readonly matcher: Matcher,
		// private titleStr: string,
	) {
		super("log-item-group");
		this.container.classList.add("log-item-group"); // todo: remove this line

		this.updateTitle();

		this.container.append(
			this.title,
		);
	}

	public matches(log: string): boolean {
		return this.matcher.matches(log);
	}

	public log(log: LogItemController) {
		this.seen++;
		this.updateTitle();
		if (this.firstLog) {
			return;
		}
		this.firstLog = log;
		this.container.append(log.getContainer());
	}

	private titleTimeout: ReturnType<typeof setTimeout> | null = null;

	private updateTitle() {
		if (this.titleTimeout) {
			clearTimeout(this.titleTimeout);
		}

		this.titleTimeout = setTimeout(() => {
			this.title.innerText = `Group '${this.matcher.pattern}' matched ${new Intl.NumberFormat().format(this.seen)} times.`;
		}, 10);
	}
}

class LogItemController extends AbstractBaseController {

	private readonly dateElm: HTMLElement;

	constructor(
		logEntry: LogEntry,
		detailsDialog: LogDetailsDialog,
	) {
		super("log-item");
		this.container.classList.add("log-item"); // todo: remove this line

		this.container.textContent = logEntry.getMessage();
		if (logEntry.hasDetails()) {
			this.container.textContent += "\n ... [details]";
		}

		this.dateElm = makeTimeElement(logEntry.getDate());
		this.container.prepend(this.dateElm);

		let preventSingleClick = false;
		let clickTimeout: ReturnType<typeof setTimeout> | null = null;
		this.container.addEventListener("click", (e) => {
			console.log("click", preventSingleClick);

			// this lets you select text in the log item without triggering the details dialog
			const cellText = document.getSelection();
			if (cellText.type === "Range") {
				return;
			}

			if (preventSingleClick) {
				preventSingleClick = false;
				return;
			}

			if (clickTimeout) {
				clearTimeout(clickTimeout);
				clickTimeout = null;
				return;
			}

			clickTimeout = setTimeout(() => {
				if (!preventSingleClick) {
					detailsDialog.showDetails(logEntry);
				}
			}, 400);
		});

		this.container.addEventListener("dblclick", () => {
			console.log("dblclick", preventSingleClick);
			preventSingleClick = true;
			if (clickTimeout) {
				clearTimeout(clickTimeout);
				clickTimeout = null;
			}
		});
	}
}

function matchers(text: string, m: typeof Matcher = Matcher) {
	return text.trim().split("\n").filter((v) => v.trim() != "").map(line => new m(line));
}

class Matcher {

	private reg: RegExp;

	constructor(public readonly pattern: string) {
		this.reg = new RegExp(pattern);
	}

	public matches(log: string): boolean {
		return this.reg.test(log);
	}
}

function makeLogFilter(inclusions: Matcher[], exclusions: Matcher[]): LogFilter {
	return (logEntry: LogEntry) => {
		const log = logEntry.getRawEntry();
		if (exclusions.some(e => e.matches(log))) {
			return false;
		}

		return !(inclusions.length > 0 && inclusions.some(i => !i.matches(log)));
	};
}

function makeTimeElement(date: Date) {
	const dateElm = document.createElement("time");
	dateElm.dateTime = date.toISOString();
	dateElm.textContent = date.toLocaleString("en-US", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		timeZoneName: "short"
	});
	return dateElm;
}
