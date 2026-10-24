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
     6. Task 2 — Parent Enquiry Form + local private database
     ========================================================= */
  const form = document.getElementById("enquiryForm");

  if (form) {
    const alertBox = document.getElementById("formAlert");
    const result = document.getElementById("submittedData");
    const resultContent = document.getElementById("submittedDataContent");

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
      const validationMessages = [];

      if (!parentName) {
        const error = "Please enter the parent / guardian name.";
        setError("parentNameError", error);
        validationMessages.push(error);
        valid = false;
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        const error = "Please enter a valid email address.";
        setError("parentEmailError", error);
        validationMessages.push(error);
        valid = false;
      }

      const phoneDigits = phone.replace(/\D/g, "");
      const phoneValid = /^(?:01\d{8,9}|601\d{8,9})$/.test(phoneDigits);

      if (!phone || !phoneValid) {
        const error = "Please enter a valid Malaysian phone number.";
        setError("phoneNumberError", error);
        validationMessages.push(error);
        valid = false;
      }

      if (!studentName) {
        const error = "Please enter the student name.";
        setError("studentNameError", error);
        validationMessages.push(error);
        valid = false;
      }

      if (!studentClass) {
        const error = "Please select the student year / class.";
        setError("studentClassError", error);
        validationMessages.push(error);
        valid = false;
      }

      if (!category) {
        const error = "Please select an enquiry category.";
        setError("enquiryCategoryError", error);
        validationMessages.push(error);
        valid = false;
      }

      if (!contactMethod) {
        const error = "Please select a preferred contact method.";
        setError("contactMethodError", error);
        validationMessages.push(error);
        valid = false;
      }

      if (!message) {
        const error = "Please enter your enquiry message.";
        setError("enquiryMessageError", error);
        validationMessages.push(error);
        valid = false;
      }

      if (!valid) {
        const error = validationMessages.join(" ");
        showAlert(error);
        window.alert("Error: " + error);
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
      };

      const submitButton = form.querySelector(
        "button[type='submit'], input[type='submit']"
      );
      if (submitButton) submitButton.disabled = true;

      showAlert("Saving your enquiry to CDWS_Database.xlsx...");

      try {
        const response = await fetch(window.CDWS_DATABASE_API + "/api/enquiries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submittedData)
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error || "CDWS_Database.xlsx could not save your enquiry.");
        }

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
        showAlert("Your enquiry was saved to the Contact Enquiries worksheet.", true);

        if (result) {
          result.style.display = "block";
          result.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        form.style.display = "none";
        window.alert("Success: Your enquiry was saved to CDWS_Database.xlsx.");
      } catch (error) {
        const message = error.message + " Start the local server and keep the form open so you can retry.";
        showAlert(message);
        window.alert("Error: " + message);
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
