/* =========================================================
   CDWP2203 Introduction to Web Programming
   Horizon International School — Shared JavaScript
   Purpose: Navigation, accessibility, animations, slideshows,
            activity filtering and Task 2 form validation.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  /* =========================================================
     1. Mobile Navigation
     Opens and closes the navigation menu on smaller screens.
     ========================================================= */
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector(".nav-menu");

  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      const open = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* =========================================================
     2. Active Navigation Link
     Highlights the link that matches the current webpage.
     ========================================================= */
  const page = location.pathname.split("/").pop() || "index.html";

  document.querySelectorAll(".nav-menu a").forEach(link => {
    if (link.getAttribute("href") === page) {
      link.classList.add("active");
    }
  });

  /* =========================================================
     3. Scroll Reveal Animation
     Reveals content when it enters the visible area.
     ========================================================= */
  
  const reveals = document.querySelectorAll(".reveal");

  // Make content visible first, so a failed observer cannot hide the page.
  reveals.forEach(element => element.classList.add("visible"));

  // Keep the reveal animation logic without risking permanently hidden content.
  if ("IntersectionObserver" in window) {
    try {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });

      reveals.forEach(element => observer.observe(element));
    } catch (error) {
      console.error("Reveal animation could not be initialized:", error);
    }
  }


  /* =========================================================
     4. Slideshow
     Provides previous/next controls and automatic slide changes.
     Used on the Home and News pages.
     ========================================================= */
  const slides = [...document.querySelectorAll(".slide")];
  let currentSlide = 0;

  const showSlide = index => {
    if (!slides.length) return;

    currentSlide = (index + slides.length) % slides.length;

    slides.forEach((slide, index) => {
      slide.classList.toggle("active", index === currentSlide);
    });
  };

  document.querySelectorAll("[data-slide='prev']").forEach(button => {
    button.addEventListener("click", () => showSlide(currentSlide - 1));
  });

  document.querySelectorAll("[data-slide='next']").forEach(button => {
    button.addEventListener("click", () => showSlide(currentSlide + 1));
  });

  if (slides.length > 1) {
    showSlide(0);
    setInterval(() => showSlide(currentSlide + 1), 6000);
  }

  /* =========================================================
     5. Co-curricular Activity Filter
     Filters activity cards by category without reloading the page.
     ========================================================= */
  const filterButtons = document.querySelectorAll(".filter-btn");
  const activityCards = document.querySelectorAll(".activity-card");

  filterButtons.forEach(button => {
    button.addEventListener("click", () => {
      filterButtons.forEach(item => {
        item.classList.remove("active");
        item.setAttribute("aria-pressed", "false");
      });

      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");

      const filter = button.dataset.filter;

      activityCards.forEach(card => {
        const shouldShow = filter === "all" || card.dataset.category === filter;
        card.classList.toggle("hidden-card", !shouldShow);
      });
    });
  });

 
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

      const parentName = document.getElementById("parentName").value.trim();
      const email = document.getElementById("parentEmail").value.trim();
      const phone = document.getElementById("phoneNumber").value.trim();
      const studentName = document.getElementById("studentName").value.trim();
      const studentClass = document.getElementById("studentClass").value;
      const category = document.getElementById("enquiryCategory").value;
      const contactMethod = document.querySelector(
        "input[name='contactMethod']:checked"
      );
      const message = document.getElementById("enquiryMessage").value.trim();

      const requested = [
        ...document.querySelectorAll(
          "input[name='informationRequested']:checked"
        )
      ].map(item => item.value);

      let valid = true;

      if (!parentName) {
        setError("parentNameError", "Please enter the parent / guardian name.");
        valid = false;
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError("parentEmailError", "Please enter a valid email address.");
        valid = false;
      }

      const phoneDigits = phone.replace(/\D/g, "");
      const phoneValid = /^(?:01\d{8,9}|601\d{8,9})$/.test(phoneDigits);

      if (!phone || !phoneValid) {
        setError("phoneNumberError", "Please enter a valid Malaysian phone number.");
        valid = false;
      }

      if (!studentName) {
        setError("studentNameError", "Please enter the student name.");
        valid = false;
      }

      if (!studentClass) {
        setError("studentClassError", "Please select the student year / class.");
        valid = false;
      }

      if (!category) {
        setError("enquiryCategoryError", "Please select an enquiry category.");
        valid = false;
      }

      if (!contactMethod) {
        setError("contactMethodError", "Please select a preferred contact method.");
        valid = false;
      }

      if (!message) {
        setError("enquiryMessageError", "Please enter your enquiry message.");
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

      // Display submitted information safely on the page.
      if (resultContent) {
        resultContent.innerHTML = `
          <p><strong>Parent / Guardian Name:</strong> ${escapeHTML(parentName)}</p>
          <p><strong>Email:</strong> ${escapeHTML(email)}</p>
          <p><strong>Phone Number:</strong> ${escapeHTML(phone)}</p>
          <p><strong>Student Name:</strong> ${escapeHTML(studentName)}</p>
          <p><strong>Student Year / Class:</strong> ${escapeHTML(studentClass)}</p>
          <p><strong>Enquiry Category:</strong> ${escapeHTML(category)}</p>
          <p><strong>Information Requested:</strong> ${escapeHTML(submittedData.informationRequested || "None selected")}</p>
          <p><strong>Preferred Contact Method:</strong> ${escapeHTML(contactMethod.value)}</p>
          <p><strong>Enquiry Message:</strong> ${escapeHTML(message)}</p>
        `;
      }

      const submitButton = form.querySelector(
        "button[type='submit'], input[type='submit']"
      );
      if (submitButton) submitButton.disabled = true;

      showAlert("Your enquiry is displayed below. Sending a copy to Google Sheets…");

      try {
        const payload = new URLSearchParams();

        Object.entries(submittedData).forEach(([key, value]) => {
          payload.append(key, value == null ? "" : String(value));
        });

        await fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          mode: "no-cors",
          body: payload
        });

        // no-cors cannot confirm whether Apps Script saved the row.
        showAlert(
          "Your enquiry is displayed below. Please check Google Sheets to confirm that the enquiry was saved."
        );

        if (result) {
          result.style.display = "block";
          result.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        form.style.display = "none";
      } catch (error) {
        console.error("Google Sheets submission error:", error);

        showAlert(
          "Your enquiry is displayed below, but the request to Google Sheets could not be sent. Please check the connection and try again."
        );

        if (result) {
          result.style.display = "block";
          result.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });

    form.addEventListener("reset", () => {
      setTimeout(() => {
        clearErrors();
        if (result) result.style.display = "none";
        form.style.display = "";
      }, 0);
    });
  }
});
