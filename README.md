# Formellt

A class for handling forms. Easily sanitize, validate, and display errors.

## Usage

### HTML

```html
<!-- A minimalist example. Please use labels and keep your form accessible. -->

<form>
    <input type="text" placeholder="username" name="username">
    <span data-error="username">
    <br>

    <input type="text" placeholder="password" name="password">
    <span data-error="password">
    <br>

    <input type="text" placeholder="password2" name="password2">
    <span data-error="password">
    <br>

    <input type="checkbox" placeholder="privacy" name="privacy">
    <span data-error="privacy">
    <br>

    <button>
        Submit
    </button>
    <span data-spam-error data-response-error>
</form>
```

### JavaScript

```js
import Formellt from "./index.js"

//                            ↓ CSS selector or HTMLFormElement
const handler = new Formellt("#signup-form", {  // only validator and onSubmit are required in this init object
    sanitizer(formData) {
        formData.username = formData.username.trim().replaceAll(/\s+/gm, " ")
    },

    //        ↓ formData if no sanitizer is provided 
    validator(sanitized, dispatchError) {
        if (!formData.username) {
            dispatchError("username", "required")   // first arg corresponds to the data-error in the spans above
        } else if (formData.username.length < 4) {
            dispatchError("username", "Must be at least 4 characters.")
        }

        if (!formData.password) {
            dispatchError("password", "required")
        } else if (formData.password.length < 8) {
            dispatchError("password", "Must be at least 8 characters.")
        } else if (formData.password !== formData.password2) {
            dispatchError("password", "Passwords musts match.")
        }

        if (!formData.privacy.checked) {
            dispatchError("privacy", "You must read the privacy policy.")
        }
    },

    //// Handling the submission and responses ///
    //                      ↓ same as formData if no sanitizer provided
    onSubmit(_e, formData, sanitized) {
        // return a response object to trigger the onGoodRes/onBadRes hooks
        return fetch("url-goes-here", {
            method: "POST",
            body: JSON.stringify(sanitized)
        })
    },
    onGoodRes(_res, data) {
        console.log(data)
    },
    onBadRes(res, _data) {
        return `Error ${res.status}: ${res.statusText}`
        // returned value will render in the element with data-response-error
    },

    /// Other nifty stuff ///
    /*
        PROPERTY                    DATA TYPE               DEFAULT

        validateOnChange:           boolean                 false
            call the sanitizer and validator any time an input changes

        validateOnMutate:           boolean                 false
            call the sanitizer and validator if the form's DOM subtree changes

        validateOnMount:            boolean                 false
            call the sanitizer and validator immediately as the form loads

        allowInvalid:               boolean                 false
            allow onSubmit to be called even if the form has errors

        preventSpam:                boolean                 false
            prevent submissions if onSubmit is busy

        spamErrorMsg:               string                  "Please wait."
            message to display in the element with "data-spam-error" if the form is spammed

        submitMsg:                  string                  "Fix errors."
            message to display in the element with "data-response-error"
            if the form does not pass the validator and allowInvalid is false

        mutationCallback:           MutationCallback        undefined
            if provided, a mutation observer will be defined that listens for
            changes in the childList and subtree
    */
})
```

### TypeScript

```ts
import Formellt from "./index.js"

type FormData = {
    username: string
    password: string
    password2: string
    privacy: boolean
}

// Optional, defaults to FormData
type Sanitized = {
    username: string
    password: string
    password2: string
    privacy: boolean
}

// Optional, defaults to any
type Data = {
    token: string
    errorMessage: string
}

const handler = new Formellt<FormData, Sanitized, Data>("#signup-form", {
    /*
            See JavaScript example above for what the init object should look like

            formData in validator, sanitizer, and onSubmit will be the first type
            sanitized in onSubmit will be the second type
            data in onGoodRes and onBadRes will be the third type
    */
})
```