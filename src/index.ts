export type FormelltSelector = HTMLFormElement | string;
export type FormelltError = { msg: string, data?: any };
export type FormelltErrorDispatcher<FD> = (name: keyof FD, msg: string) => void;
export type FormelltSanitizer<FD, S> = (fd: FD) => S;
export type FormelltValidator<FD, S> = (s: S, dispatchError: FormelltErrorDispatcher<FD>) => void;
export type FormelltSubmitHandler<FD, S> = (e: SubmitEvent, formData: FD, sanitized: S) => ((Response | void) | Promise<Response | void>);
export type FormelltResponseHandler<Data> = (res: Response, json?: Data) => (undefined | string);
export type FormelltInit<FD, S = FD, Data = any> = {
    onSubmit: FormelltSubmitHandler<FD, S>
    validator: FormelltValidator<FD, S>
    // optional
    sanitizer?: FormelltSanitizer<FD, S>
    validateOnChange?: boolean
    validateOnMount?: boolean
    validateOnMutate?: boolean
    mutationCallback?: MutationCallback
    allowInvalid?: boolean
    submitErrorMsg?: string
    preventSpam?: boolean
    spamErrorMsg?: string
    onGoodRes?: FormelltResponseHandler<Data>
    onBadRes?: FormelltResponseHandler<Data>
}

export type FormelltInput = (
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement
)


class Formellt<FormDataSchema extends Record<string, any>, Sanitized = FormDataSchema, Data = any> {
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
    validator: FormelltValidator<FormDataSchema, Sanitized>
    sanitizer: FormelltSanitizer<FormDataSchema, Sanitized> = (fd) => fd as unknown as Sanitized;
    onSubmit: FormelltSubmitHandler<FormDataSchema, Sanitized>
    allowInvalid: boolean
    submitErrorMsg: string
    errors: Map<keyof FormDataSchema, string> = new Map()
    preventSpam: boolean
    spamErrorMsg: string
    validateOnChange: boolean
    validateOnMount: boolean

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
        return this.errorNames.length === 0
    }

    get submitErrorElement(): HTMLElement | null {
        return this.querySelector("*[data-submit-error]")
    }

    get spamElement(): HTMLElement | null {
        return this.querySelector("*[data-spam-error]")
    }

    get responseElement(): HTMLElement | null {
        return this.querySelector("*[data-response-error]")
    }

    get errorNames(): string[] {
        return Object.keys(Object.fromEntries(this.errors))
    }

    get sanitized(): Sanitized {
        return this.sanitizer(this.formData)
    }

    ///////////////////////////////////////////////////////////
    constructor(selector: FormelltSelector, init: FormelltInit<FormDataSchema, Sanitized>) {
        this.form = Formellt.getForm(selector)
        if (init.sanitizer) this.sanitizer = init.sanitizer
        this.validator = init.validator
        this.onSubmit = init.onSubmit
        this.allowInvalid = init.allowInvalid === true;
        this.submitErrorMsg = init.submitErrorMsg || "Fix errors.";
        this.preventSpam = init.preventSpam === true;
        this.spamErrorMsg = init.spamErrorMsg || "Please wait.";
        this.onGoodRes = init.onGoodRes || (() => {}) as FormelltResponseHandler<Data>
        this.onBadRes = init.onBadRes || (() => {}) as FormelltResponseHandler<Data>
        this.validateOnChange = init.validateOnChange || false
        this.validateOnMount = init.validateOnMount || false

        // handle submit
        this.form.addEventListener("submit", e => {
            e.preventDefault()
            this.submit(e)
        })

        // handle change or input
        if (this.validateOnChange) {
            this.form.addEventListener("change", () => {
                this.validate()
            })
        }

        // handle start
        if (this.validateOnMount) this.validate()

        // handle mutate
        this.observer = new MutationObserver((records) => {
            if (init.mutationCallback) init.mutationCallback(records, this.observer);
            if (init.validateOnMutate) {
                if (records.some(r => r.type === "childList")) this.validate()
            }
            // this.validate()
        })
        this.observer.observe(this.form, {
            subtree: true,
            childList: true
        })
        
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

        this.validate()

        if (!this.allowInvalid && !this.valid) {
            // spam guard, UNLOCK
            this.submitting = false
            return
        };
        
        const res = await this.onSubmit(e, this.formData, this.sanitized)

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
        this.errorNames.forEach(name => {
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
        if (this.preventSpam && this.spamElement) this.spamElement.innerHTML = this.spamErrorMsg;
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

    validate() {
        this.resetErrors()
        this.validator(this.sanitized, this.dispatchError.bind(this))
        if (!this.allowInvalid && !this.valid) {
            this.displayErrors()
            this.displaySubmitError()
            return
        }
    }
}

export default Formellt