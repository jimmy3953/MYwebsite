
  /* =========================================================
     6. Task 2 — Parent Enquiry Form + Google Sheets
     ========================================================= */

  const form = document.getElementById("enquiryForm");

  if (form) {
    const alertBox = document.getElementById("formAlert");
    const result = document.getElementById("submittedData");
    const resultContent = document.getElementById("submittedDataContent");

    const GOOGLE_SCRIPT_URL =
      "https://script.google.com/a/macros/oum.edu.my/s/AKfycbxFrbP3YKUOfc51SBnyZlNb7WaoVAcUauCNbWh6I6qoZOh4Wm9NEk2tlB6JVPwHP0diCA/exec";

    const setError = (id, message) => {
      const element = document.getElementById(id);
      if (element) element.textContent = message;
    };

    const clearErrors = () => {
      form.querySelectorAll(".error").forEach(element => {
        element.textContent = "";
      });

      if (alertBox) {
        alertBox.classList.remove("show");
        alertBox.textContent = "";
      }
    };

    const escapeHTML = value => {
      const div = document.createElement("div");
      div.textContent = String(value ?? "");
      return div.innerHTML;
    };

    const showAlert = (message, success = false) => {
      if (!alertBox) return;

      alertBox.classList.add("show");
      alertBox.style.background = success ? "#eaf7ee" : "#fff4e5";
      alertBox.style.borderColor = success ? "#b9dfc5" : "#f2c078";
      alertBox.style.color = success ? "#175b2c" : "#7a3e00";
      alertBox.textContent = message;
    };

    form.addEventListener("submit", async event => {
      event.preventDefault();
      clearErrors();

      const parentName =
        document.getElementById("parentName").value.trim();
      const email =
        document.getElementById("parentEmail").value.trim();
      const phone =
        document.getElementById("phoneNumber").value.trim();
      const studentName =
        document.getElementById("studentName").value.trim();
      const studentClass =
        document.getElementById("studentClass").value;
      const category =
        document.getElementById("enquiryCategory").value;
      const contactMethod =
        document.querySelector("input[name='contactMethod']:checked");
      const message =
        document.getElementById("enquiryMessage").value.trim();

      const requested = [
        ...document.querySelectorAll(
          "input[name='informationRequested']:checked"
        )
      ].map(item => item.value);

      let valid = true;

      if (!parentName) {
        setError("parentNameError",
          "Please enter the parent / guardian name.");
        valid = false;
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError("parentEmailError",
          "Please enter a valid email address.");
        valid = false;
      }

      const phoneDigits = phone.replace(/\D/g, "");
      const phoneValid = /^(?:01\d{8,9}|601\d{8,9})$/.test(phoneDigits);

      if (!phone || !phoneValid) {
        setError("phoneNumberError",
          "Please enter a valid Malaysian phone number.");
        valid = false;
      }

      if (!studentName) {
        setError("studentNameError",
          "Please enter the student name.");
        valid = false;
      }

      if (!studentClass) {
        setError("studentClassError",
          "Please select the student year / class.");
        valid = false;
      }

      if (!category) {
        setError("enquiryCategoryError",
          "Please select an enquiry category.");
        valid = false;
      }

      if (!contactMethod) {
        setError("contactMethodError",
          "Please select a preferred contact method.");
        valid = false;
      }

      if (!message) {
        setError("enquiryMessageError",
          "Please enter your enquiry message.");
        valid = false;
      }

      if (!valid) {
        showAlert(
          "Please complete all required fields and correct the highlighted information."
        );
        alert("Please complete all required fields.");
        return;
      }

      const submittedData = {
        parentName,
        email,
        phone,
        studentName,
        studentClass,
        category,
        informationRequested: requested.join(", "),
        contactMethod: contactMethod.value,
        message,
        submittedAt: new Date().toISOString()
      };

      // Display the submitted information safely on the page.
      if (resultContent) {
        resultContent.innerHTML = `
          <p><strong>Parent / Guardian Name:</strong> ${escapeHTML(parentName)}</p>
          <p><strong>Email:</strong> ${escapeHTML(email)}</p>
          <p><strong>Phone Number:</strong> ${escapeHTML(phone)}</p>
          <p><strong>Student Name:</strong> ${escapeHTML(studentName)}</p>
          <p><strong>Student Year / Class:</strong> ${escapeHTML(studentClass)}</p>
          <p><strong>Enquiry Category:</strong> ${escapeHTML(category)}</p>
          <p><strong>Information Requested:</strong> ${escapeHTML(requestedData.informationRequested || "None selected")}</p>
          <p><strong>Preferred Contact Method:</strong> ${escapeHTML(contactMethod.value)}</p>
          <p><strong>Enquiry Message:</strong> ${escapeHTML(message)}</p>
        `;
      }

      // Send the form fields to Google Apps Script.
      // no-cors means the browser cannot read the server's response.
      const payload = new URLSearchParams(submittedData);

      const submitButton = form.querySelector(
        "button[type='submit'], input[type='submit']"
      );

      if (submitButton) submitButton.disabled = true;

      showAlert("Sending your enquiry to Google Sheets. Please wait.");

      try {
        await fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          mode: "no-cors",
          body: payload
        });

        // The opaque response cannot confirm whether the sheet saved the row.
        showAlert(
          "The request was sent. The webpage can display your enquiry, but please verify the Google Sheets row before treating it as saved.",
          false
        );

        if (result) {
          result.style.display = "block";
          result.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } catch (error) {
        console.error("Google Sheets submission error:", error);

        showAlert(
          "The request could not be sent. Please check your connection and try again."
        );
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });

    form.addEventListener("reset", () => {
      setTimeout(() => {
        clearErrors();
        if (result) result.style.display = "none";
      }, 0);
    });
  }
