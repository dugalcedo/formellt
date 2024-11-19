type FormelltSelector = HTMLFormElement | string;
type FormelltError = { msg: string, data?: any };
type FormelltSubmitHandler<FD> = (e: SubmitEvent, formData: FD) => ((Response | void) | Promise<Response | void>);
type FormelltErrorDispatcher<FD> = (name: keyof FD, msg: string) => void;
type FormelltValidator<FD> = (fd: FD, dispatchError: FormelltErrorDispatcher<FD>) => void;
type FormelltResponseHandler<Data> = (res: Response, json?: Data) => (undefined | string);
type FormelltInit<FD, Data = any> = {
    onSubmit: FormelltSubmitHandler<FD>
    validator: FormelltValidator<FD>
    // optional
    observerCallback?: MutationCallback
    allowInvalid?: boolean
    submitErrorMsg?: string
    preventSpam?: boolean
    spamMsg?: string
    onGoodRes?: FormelltResponseHandler<Data>
    onBadRes?: FormelltResponseHandler<Data>
}

type FormelltInput = (
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement
)


class Formellt<FormDataSchema extends Record<string, any>, Data = any> {
    // Static

    static err(msg: string, data?: any): FormelltError {
        return {msg, data}
    }

    static verifyIsForm(el: HTMLElement) {
        if (el.tagName !== "FORM") throw Formellt.err("Not a form.", el);
    }

    static getForm(s: FormelltSelector): HTMLFormElement {
        if (typeof s === "string") {
            const el = document.querySelector<HTMLFormElement>(s)
            if (!el) throw Formellt.err(`The selector did not match any HTML elements.`, s);
            Formellt.verifyIsForm(el);
            return el;
        } else {
            Formellt.verifyIsForm(s);
            return s;
        }
    }

    // Public properties

    form: HTMLFormElement
    observer: MutationObserver
    onSubmit: FormelltSubmitHandler<FormDataSchema>
    validator: FormelltValidator<FormDataSchema>
    allowInvalid: boolean
    submitErrorMsg: string
    errors: Map<keyof FormDataSchema, string> = new Map()
    preventSpam: boolean
    spamMsg: string

    submitting: boolean = false;
    onGoodRes: FormelltResponseHandler<Data>
    onBadRes: FormelltResponseHandler<Data>

    // Public getters

    get inputs(): HTMLInputElement[] {
        return this.querySelectorAll("input")
    }

    get textareas(): HTMLTextAreaElement[] {
        return this.querySelectorAll("textares")
    }

    get selects(): HTMLSelectElement[] {
        return this.querySelectorAll("selects")
    }

    get all(): FormelltInput[] {
        return this.querySelectorAll(":scope input, textarea, select")
    }

    get formData(): FormDataSchema {
        return Object.fromEntries(new FormData(this.form)) as FormDataSchema
    }

    get errorElements(): HTMLElement[] {
        return this.querySelectorAll("*[data-error]")
    }

    get valid(): boolean {
        return Object.keys(this.errors).length === 0
    }

    get submitErrorElement(): HTMLElement | null {
        return this.querySelector("*[data-submit-error]")
    }

    get spamElement(): HTMLElement | null {
        return this.querySelector("*[data-spam]")
    }

    get responseElement(): HTMLElement | null {
        return this.querySelector("*[data-response]")
    }

    ///////////////////////////////////////////////////////////
    constructor(selector: FormelltSelector, init: FormelltInit<FormDataSchema>) {
        this.form = Formellt.getForm(selector)
        this.onSubmit = init.onSubmit
        this.validator = init.validator
        this.allowInvalid = init.allowInvalid === true;
        this.submitErrorMsg = init.submitErrorMsg || "Fix errors.";
        this.form.addEventListener("submit", this.onSubmit.bind(this))
        this.preventSpam = init.preventSpam === true;
        this.spamMsg = init.spamMsg || "Please wait.";
        this.onGoodRes = init.onGoodRes || (() => {}) as FormelltResponseHandler<Data>
        this.onBadRes = init.onBadRes || (() => {}) as FormelltResponseHandler<Data>
        
        if (init.observerCallback) {
            this.observer = new MutationObserver(init.observerCallback)
            this.observer.observe(this.form, {
                subtree: true,
                childList: true
            })
        }
    } ///////////////////////////////////////////////////////

    // Public methods

    querySelector<T extends Element>(selector: string): (T | null) {
        return this.form.querySelector<T>(`:scope ${selector}`)
    }

    querySelectorAll<T extends Element>(selector: string): T[] {
        return [...this.form.querySelectorAll<T>(`:scope ${selector}`)]
    }

    forEach(cb: (el: FormelltInput, i: number, all: FormelltInput[]) => void) {
        this.all.forEach(cb)
    }

    forEachInput(cb: (el: HTMLInputElement, i: number, all: HTMLInputElement[]) => void) {
        this.inputs.forEach(cb)
    }

    forEachSelect(cb: (el: HTMLSelectElement, i: number, all: HTMLSelectElement[]) => void) {
        this.selects.forEach(cb)
    }

    forEachTextarea(cb: (el: HTMLTextAreaElement, i: number, all: HTMLTextAreaElement[]) => void) {
        this.textareas.forEach(cb)
    }

    getErrorElement(name: keyof FormDataSchema): (HTMLElement | null) {
        return this.querySelector(` *[data-error="${name.toString()}"]`)
    }

    async submit(e: SubmitEvent) {
        e.preventDefault()

        // spam guard, LOCK
        if (this.preventSpam && this.submitting) {
            this.displaySpamMessage()
            return
        }
        this.submitting = true

        this.resetErrors()
        this.validator(this.formData, this.dispatchError.bind(this))
        if (!this.allowInvalid && !this.valid) {
            this.displayErrors()
            this.displaySubmitError()
            return
        }
        
        const res = await this.onSubmit(e, this.formData)
        if (res) {
            let resMsg: undefined | string;
            if (res.ok) {
                resMsg = this.onGoodRes(res, await this.toJson(res))
            } else {
                resMsg = this.onBadRes(res, await this.toJson(res))
            }
            if (resMsg) this.displayResponseMessage(resMsg)
        }

        // spam guard, UNLOCK
        this.submitting = false
    }

    resetErrors() {
        this.errorElements.forEach(el => el.innerHTML = "");
        this.resetSubmitError()
        this.resetSpamMessage()
        this.errors = new Map()
    }

    dispatchError(name: keyof FormDataSchema, msg: string) {
        this.errors.set(name, msg)
    }

    displayErrors() {
        Object.keys(this.errors).forEach(name => {
            const errorEl = this.getErrorElement(name);
            if (!errorEl) return;
            errorEl.innerHTML = this.errors.get(name) || "";
        })
    }

    displaySubmitError() {
        if (this.submitErrorElement) this.submitErrorElement.innerHTML = this.submitErrorMsg;
    }

    resetSubmitError() {
        if (this.submitErrorElement) this.submitErrorElement.innerHTML = "";
    }

    displaySpamMessage() {
        if (this.preventSpam && this.spamElement) this.spamElement.innerHTML = this.spamMsg;
    }

    resetSpamMessage() {
        if (this.spamElement) this.spamElement.innerHTML = "";
    }

    displayResponseMessage(msg: string) {
        if (this.responseElement) this.responseElement.innerHTML = msg;
    }

    resetResponseMessage() {
        if (this.responseElement) this.responseElement.innerHTML = "";
    }

    async toJson(r: Response): Promise<Data | undefined> {
        try {
            const data = await r.json()
            return data as Data
        } catch (_) {
            return
        }
    }
}