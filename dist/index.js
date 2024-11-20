class Formellt {
    // Static
    static err(msg, data) {
        return { msg, data };
    }
    static verifyIsForm(el) {
        if (el.tagName !== "FORM")
            throw Formellt.err("Not a form.", el);
    }
    static getForm(s) {
        if (typeof s === "string") {
            const el = document.querySelector(s);
            if (!el)
                throw Formellt.err(`The selector did not match any HTML elements.`, s);
            Formellt.verifyIsForm(el);
            return el;
        }
        else {
            Formellt.verifyIsForm(s);
            return s;
        }
    }
    // Public properties
    form;
    observer;
    validator;
    sanitizer = (fd) => fd;
    onSubmit;
    allowInvalid;
    submitErrorMsg;
    errors = new Map();
    preventSpam;
    spamErrorMsg;
    validateOnChange;
    validateOnMount;
    submitting = false;
    onGoodRes;
    onBadRes;
    // Public getters
    get inputs() {
        return this.querySelectorAll("input");
    }
    get textareas() {
        return this.querySelectorAll("textares");
    }
    get selects() {
        return this.querySelectorAll("selects");
    }
    get all() {
        return this.querySelectorAll(":scope input, textarea, select");
    }
    get formData() {
        return Object.fromEntries(new FormData(this.form));
    }
    get errorElements() {
        return this.querySelectorAll("*[data-error]");
    }
    get valid() {
        return this.errorNames.length === 0;
    }
    get submitErrorElement() {
        return this.querySelector("*[data-submit-error]");
    }
    get spamElement() {
        return this.querySelector("*[data-spam-error]");
    }
    get responseElement() {
        return this.querySelector("*[data-response-error]");
    }
    get errorNames() {
        return Object.keys(Object.fromEntries(this.errors));
    }
    get sanitized() {
        return this.sanitizer(this.formData);
    }
    ///////////////////////////////////////////////////////////
    constructor(selector, init) {
        this.form = Formellt.getForm(selector);
        if (init.sanitizer)
            this.sanitizer = init.sanitizer;
        this.validator = init.validator;
        this.onSubmit = init.onSubmit;
        this.allowInvalid = init.allowInvalid === true;
        this.submitErrorMsg = init.submitErrorMsg || "Fix errors.";
        this.preventSpam = init.preventSpam === true;
        this.spamErrorMsg = init.spamErrorMsg || "Please wait.";
        this.onGoodRes = init.onGoodRes || (() => { });
        this.onBadRes = init.onBadRes || (() => { });
        this.validateOnChange = init.validateOnChange || false;
        this.validateOnMount = init.validateOnMount || false;
        // handle submit
        this.form.addEventListener("submit", e => {
            e.preventDefault();
            this.submit(e);
        });
        // handle change or input
        if (this.validateOnChange) {
            this.form.addEventListener("change", () => {
                this.validate();
            });
        }
        // handle start
        if (this.validateOnMount)
            this.validate();
        // handle mutate
        this.observer = new MutationObserver((records) => {
            if (init.mutationCallback)
                init.mutationCallback(records, this.observer);
            if (init.validateOnMutate) {
                if (records.some(r => r.type === "childList"))
                    this.validate();
            }
            // this.validate()
        });
        this.observer.observe(this.form, {
            subtree: true,
            childList: true
        });
    } ///////////////////////////////////////////////////////
    // Public methods
    querySelector(selector) {
        return this.form.querySelector(`:scope ${selector}`);
    }
    querySelectorAll(selector) {
        return [...this.form.querySelectorAll(`:scope ${selector}`)];
    }
    forEach(cb) {
        this.all.forEach(cb);
    }
    forEachInput(cb) {
        this.inputs.forEach(cb);
    }
    forEachSelect(cb) {
        this.selects.forEach(cb);
    }
    forEachTextarea(cb) {
        this.textareas.forEach(cb);
    }
    getErrorElement(name) {
        return this.querySelector(` *[data-error="${name.toString()}"]`);
    }
    async submit(e) {
        e.preventDefault();
        // spam guard, LOCK
        if (this.preventSpam && this.submitting) {
            this.displaySpamMessage();
            return;
        }
        this.submitting = true;
        this.validate();
        if (!this.allowInvalid && !this.valid) {
            // spam guard, UNLOCK
            this.submitting = false;
            return;
        }
        ;
        const res = await this.onSubmit(e, this.formData, this.sanitized);
        if (res) {
            let resMsg;
            if (res.ok) {
                resMsg = this.onGoodRes(res, await this.toJson(res));
            }
            else {
                resMsg = this.onBadRes(res, await this.toJson(res));
            }
            if (resMsg)
                this.displayResponseMessage(resMsg);
        }
        // spam guard, UNLOCK
        this.submitting = false;
    }
    resetErrors() {
        this.errorElements.forEach(el => el.innerHTML = "");
        this.resetSubmitError();
        this.resetSpamMessage();
        this.errors = new Map();
    }
    dispatchError(name, msg) {
        this.errors.set(name, msg);
    }
    displayErrors() {
        this.errorNames.forEach(name => {
            const errorEl = this.getErrorElement(name);
            if (!errorEl)
                return;
            errorEl.innerHTML = this.errors.get(name) || "";
        });
    }
    displaySubmitError() {
        if (this.submitErrorElement)
            this.submitErrorElement.innerHTML = this.submitErrorMsg;
    }
    resetSubmitError() {
        if (this.submitErrorElement)
            this.submitErrorElement.innerHTML = "";
    }
    displaySpamMessage() {
        if (this.preventSpam && this.spamElement)
            this.spamElement.innerHTML = this.spamErrorMsg;
    }
    resetSpamMessage() {
        if (this.spamElement)
            this.spamElement.innerHTML = "";
    }
    displayResponseMessage(msg) {
        if (this.responseElement)
            this.responseElement.innerHTML = msg;
    }
    resetResponseMessage() {
        if (this.responseElement)
            this.responseElement.innerHTML = "";
    }
    async toJson(r) {
        try {
            const data = await r.json();
            return data;
        }
        catch (_) {
            return;
        }
    }
    validate() {
        this.resetErrors();
        this.validator(this.sanitized, this.dispatchError.bind(this));
        if (!this.allowInvalid && !this.valid) {
            this.displayErrors();
            this.displaySubmitError();
            return;
        }
    }
}
export default Formellt;
