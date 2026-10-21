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
     6. Task 2 — Parent Enquiry Form
     Validates required inputs and displays submitted data.
     ========================================================= */
  const form = document.getElementById("enquiryForm");

  if (form) {
    const alertBox = document.getElementById("formAlert");
    const result = document.getElementById("submittedData");
    const resultContent = document.getElementById("submittedDataContent");

    /* ---------------------------------------------------------
       6.1 Helper Functions
       --------------------------------------------------------- */
    const setError = (id, message) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = message;
      }
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

    // Prevent user-entered text from being interpreted as HTML.
    const escapeHTML = value => {
      const div = document.createElement("div");
      div.textContent = value;
      return div.innerHTML;
    };

    /* ---------------------------------------------------------
       6.2 Form Submission & Validation
       --------------------------------------------------------- */
    form.addEventListener("submit", event => {
      event.preventDefault();
      clearErrors();

      // Read all form values.
      const parentName = document.getElementById("parentName").value.trim();
      const email = document.getElementById("parentEmail").value.trim();
      const phone = document.getElementById("phoneNumber").value.trim();
      const studentName = document.getElementById("studentName").value.trim();
      const studentClass = document.getElementById("studentClass").value;
      const category = document.getElementById("enquiryCategory").value;
      const contactMethod = document.querySelector("input[name='contactMethod']:checked");
      const message = document.getElementById("enquiryMessage").value.trim();
      const requested = [...document.querySelectorAll("input[name='informationRequested']:checked")]
        .map(item => item.value);

      let valid = true;

      // Parent / Guardian Name validation.
      if (!parentName) {
        setError("parentNameError", "Please enter the parent / guardian name.");
        valid = false;
      }

      // Email format validation.
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError("parentEmailError", "Please enter a valid email address.");
        valid = false;
      }

      // Accept common Malaysian formats: 0123456789, 012-3456789 and +60123456789.
      const phoneDigits = phone.replace(/\D/g, "");
      const phoneValid = /^(?:01\d{8,9}|601\d{8,9})$/.test(phoneDigits);

      if (!phone || !phoneValid) {
        setError("phoneNumberError", "Please enter a valid phone number.");
        valid = false;
      }

      // Student details validation.
      if (!studentName) {
        setError("studentNameError", "Please enter the student name.");
        valid = false;
      }

      if (!studentClass) {
        setError("studentClassError", "Please select the student year / class.");
        valid = false;
      }

      // Enquiry category validation.
      if (!category) {
        setError("enquiryCategoryError", "Please select an enquiry category.");
        valid = false;
      }

      // Preferred contact method validation.
      if (!contactMethod) {
        setError("contactMethodError", "Please select a preferred contact method.");
        valid = false;
      }

      // Enquiry message validation.
      if (!message) {
        setError("enquiryMessageError", "Please enter your enquiry message.");
        valid = false;
      }

      /* -------------------------------------------------------
         6.3 Invalid Submission Feedback
         Shows inline errors and the required JavaScript alert.
         ------------------------------------------------------- */
      if (!valid) {
        if (alertBox) {
          alertBox.classList.add("show");
          alertBox.style.background = "#fff4e5";
          alertBox.style.borderColor = "#f2c078";
          alertBox.style.color = "#7a3e00";
          alertBox.textContent = "Please complete all required fields and correct the highlighted information.";
        }

        alert("Please complete all required fields.");
        return;
      }

      /* -------------------------------------------------------
         6.4 Successful Submission Display
         Displays all submitted information in a structured format.
         ------------------------------------------------------- */
      const requestedText = requested.length ? requested.join(", ") : "None selected";

      resultContent.innerHTML = `
        <p><strong>Parent / Guardian Name:</strong> ${escapeHTML(parentName)}</p>
        <p><strong>Email:</strong> ${escapeHTML(email)}</p>
        <p><strong>Phone Number:</strong> ${escapeHTML(phone)}</p>
        <p><strong>Student Name:</strong> ${escapeHTML(studentName)}</p>
        <p><strong>Student Year / Class:</strong> ${escapeHTML(studentClass)}</p>
        <p><strong>Enquiry Category:</strong> ${escapeHTML(category)}</p>
        <p><strong>Information Requested:</strong> ${escapeHTML(requestedText)}</p>
        <p><strong>Preferred Contact Method:</strong> ${escapeHTML(contactMethod.value)}</p>
        <p><strong>Enquiry Message:</strong> ${escapeHTML(message)}</p>
      `;

      if (alertBox) {
        alertBox.classList.add("show");
        alertBox.style.background = "#eaf7ee";
        alertBox.style.borderColor = "#b9dfc5";
        alertBox.style.color = "#175b2c";
        alertBox.textContent = "Your enquiry has been submitted successfully.";
      }

      form.style.display = "none";
      result.style.display = "block";
      result.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    /* ---------------------------------------------------------
       6.5 Clear / Reset Form
       Restores the form and removes previous validation messages.
       --------------------------------------------------------- */
    form.addEventListener("reset", () => {
      setTimeout(() => {
        clearErrors();
        result.style.display = "none";
        form.style.display = "";
      }, 0);
    });
  }

  /* =========================================================
     7. Automatic Copyright Year
     Inserts the current year into footer elements.
     ========================================================= */
  document.querySelectorAll("[data-year]").forEach(element => {
    element.textContent = new Date().getFullYear();
  });
});
