$(document).ready(function () {
    showPage("welcome-page");

    // Welcome page - Consent checkbox and start button
    $("#consent-checkbox").on("change", function () {
        $("#start-survey").prop("disabled", !this.checked);
    });

    $("#start-survey").on("click", function () {
        if ($("#consent-checkbox").is(":checked")) {
            showPage("basic-info-page");
        }
    });

    // Basic Info page - Form submission
    $("#basic-info-form").on("submit", function (e) {
        e.preventDefault();

        const name = $("#name").val();
        const age = $("#age").val();
        const gender = $("#gender").val();

        if (!name || !age || !gender) {
            alert("Please fill all fields");
            return;
        }

        responses.basicInfo = { name, age, gender };
        showPage("instructions-page");
    });

    // Instructions page - Checkbox and start questions button
    $("#instructions-checkbox").on("change", function () {
        $("#start-questions").prop("disabled", !this.checked);
    });

    $("#start-questions").on("click", function () {
        if ($("#instructions-checkbox").is(":checked")) {
            currentQuestion = 0; // Reset question counter
            if (questions.length === 0) {
                alert("No questions available. Please check the survey setup.");
                return;
            }
            displayQuestion(questions[currentQuestion]);
        }
    });

    // Timer class
    class Timer {
        constructor(duration = 0, onComplete) {
            this.duration = duration;
            this.remaining = duration;
            this.onComplete = onComplete;
            this.isRunning = false;
        }

        start() {
            if (!this.isRunning) {
                this.isRunning = true;
                this.startTime = Date.now();
                this.interval = setInterval(() => this.update(), 1000);
            }
        }

        stop() {
            if (this.isRunning) {
                this.isRunning = false;
                clearInterval(this.interval);
                return this.getElapsedTime();
            }
            return 0;
        }

        update() {
            if (this.duration > 0) {
                this.remaining = Math.max(0, this.duration - Math.floor((Date.now() - this.startTime) / 1000));
                $("#time-value").text(this.remaining);

                if (this.remaining === 0) {
                    this.stop();
                    if (this.onComplete) this.onComplete();
                }
            }
        }

        getElapsedTime() {
            return Math.floor((Date.now() - this.startTime) / 1000);
        }
    }

    // Question display function
    function displayQuestion(question) {
        showPage("question-page");
        
        const $questionText = $("#question-text");
        const $optionsContainer = $("#options-container");
        const $timer = $("#timer");

        if (!question) {
            console.error("Invalid question data:", question);
            alert("An error occurred while loading the question. Please try again.");
            return;
        }

        $questionText.text(question.text);
        $optionsContainer.empty();
        $("#next-question").prop("disabled", true);

        // Reset and show timer
        $timer.show();
        $("#time-value").text(question.timeLimit || 0);

        if (question.displayType === "table") {
            displayTableOptions(question.headers,question.options, $optionsContainer);
        } else {
            displayNormalOptions(question.options, $optionsContainer);
        }

        currentTimer = setupQuestionTimer(question);

        $("#next-question").off("click").on("click", function () {
            if (currentTimer) currentTimer.stop();
            saveResponse(question.timeLimit);
            displayLikertScale();
        });
    }

    function setupQuestionTimer(question) {
        if (currentTimer) currentTimer.stop();

        const timer = new Timer(
            question.timeLimit,
            question.timeLimit > 0 ? handleTimeLimitExpired : null
        );

        timer.start();
        return timer;
    }

    function handleTimeLimitExpired() {
        saveResponse(true);
        displayLikertScale();
    }

    function saveResponse(time,timedOut = false) {
        const currentQ = questions[currentQuestion];
        let selectedValue;
        
        let val="timebound"

        if (currentQ.displayType === "table") {
            selectedValue = $(".options-table tr.selected").data("value");
        } else {
            selectedValue = $(".option.selected").data("value");
        }

        const timeSpent = currentTimer ? currentTimer.getElapsedTime() : 0;
        if (time==0){
            val="timefree"
        }
        responses.questions[val].push({
            questionId: currentQ.id,
            response: timedOut ? null : selectedValue+1,
            timeSpent: timeSpent,
            total:time
        });
    }

    function displayLikertScale() {
        showPage("likert-page");
        $("#timer").hide();
        
        $("input[name='confidence']").prop("checked", false);
        $("#next-likert").prop("disabled", true);

        $(".likert-option input").off("change").on("change", function () {
            $("#next-likert").prop("disabled", false);
        });

        $("#next-likert").off("click").on("click", function () {
            const likertValue = $("input[name='confidence']:checked").val();
            responses.likertScales.push({
                questionId: questions[currentQuestion].id,
                confidence: parseInt(likertValue)
            });
            moveToNextQuestion();
        });
    }

    function moveToNextQuestion() {
        currentQuestion++;

        if (currentQuestion < questions.length) {
            displayQuestion(questions[currentQuestion]);
        } else {
            showStressAssessment();
        }
    }

    function showStressAssessment() {
        showPage("stress-assessment");
        $("#timer").hide();

        $("input[name='free-stress']").off("change").on("change", function () {
            const showScale = $(this).val() === "yes";
            $(".stress-scale").toggleClass("hidden", !showScale);
            updateStressNextButton();
        });

        $("input[name='stress-level']").off("change").on("change", updateStressNextButton);

        $("#next-stress-assessment").off("click").on("click", function () {
            saveStressAssessment();
            showStressTypeQuestion();
        });
    }

    function updateStressNextButton() {
        const hasAnswer = $("input[name='free-stress']:checked").length > 0;
        const needsScale = $("input[name='free-stress']:checked").val() === "yes";
        const hasScale = needsScale ? $("input[name='stress-level']:checked").length > 0 : true;

        $("#next-stress-assessment").prop("disabled", !(hasAnswer && hasScale));
    }

    function saveStressAssessment() {
        const stressAnswer = $("input[name='free-stress']:checked").val();
        const stressLevel = $("input[name='stress-level']:checked").val();

        responses.stressAssessment = {
            freeStress: stressAnswer,
            stressLevel: stressAnswer === "yes" ? parseInt(stressLevel) : null
        };
    }

    function showStressTypeQuestion() {
        showPage("stress-type-page");

        $("input[name='stress-type']").off("change").on("change", function () {
            $("#submit-survey").prop("disabled", false);
        });

        $("#submit-survey").off("click").on("click", function () {
            const selectedStressType = $("input[name='stress-type']:checked").val();
            responses.stressAssessment.stressType = selectedStressType;
            submitSurvey();
        });
    }

    async function submitSurvey() {
        // Get the submit button
        const submitButton = $("#submit-survey");
        
        // Check if submission is in progress
        if (submitButton.prop('disabled')) {
            return; // Exit if already submitting
        }
        
        try {
            // Disable the button and change text to show progress
            submitButton.prop('disabled', true);
            submitButton.text('Submitting...');
            
            // Log the responses object for debugging
            console.log("Submitting survey responses:", responses);
        
            // Define the server endpoint
            const endpoint = "https://nasirresearch.azurewebsites.net/rec/addrec";
        
            // Send the responses object to the server via POST request
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    basicInfo: responses.basicInfo,
                    questions: {
                        timefree: responses.questions.timefree,
                        timebound: responses.questions.timebound
                    },
                    likertScales: responses.likertScales,
                    stressAssessment: responses.stressAssessment
                })
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
    
            const data = await response.json();
            console.log("Survey submitted successfully:", data);
            
            // Show thank you page only after successful submission
            showPage("thank-you-page");
            
            // Clear the responses to prevent resubmission if user navigates back
            responses = {
                basicInfo: {},
                questions: {
                    timefree: [],
                    timebound: []
                },
                likertScales: [],
                stressAssessment: {}
            };
            
        } catch (error) {
            console.error("Error submitting survey:", error);
            alert("Failed to submit survey. Please try again.");
            
            // Re-enable the button on error
            submitButton.prop('disabled', false);
            submitButton.text('Submit Survey');
        }
    }
    
    
    function showPage(pageId) {
        $(".page").addClass("hidden");
        $("#" + pageId).removeClass("hidden");
    }

    function displayNormalOptions(options, container) {
        const $optionsList = $("<div>").addClass("options-normal");

        options.forEach((option, index) => {
            const $option = $("<div>")
                .addClass("option")
                .text(option)
                .data("value", index)
                .on("click", function () {
                    $(".option").removeClass("selected");
                    $(this).addClass("selected");
                    $("#next-question").prop("disabled", false);
                });

            $optionsList.append($option);
        });

        container.append($optionsList);
    }

    function displayTableOptions(headers, options, container) {
        const $table = $("<table>").addClass("options-table");
    
        // Create the table header
        const $thead = $("<thead>");
        const $headerRow = $("<tr>");
        headers.forEach((header) => {
            $("<th>").text(header).appendTo($headerRow);
        });
        $thead.append($headerRow);
        $table.append($thead);
    
        // Create the table body
        const $tbody = $("<tbody>");
        options.forEach((row, rowIndex) => {
            const $row = $("<tr>").data("value", rowIndex);
    
            row.forEach((cell) => {
                $("<td>").text(cell).appendTo($row);
            });
    
            $row.on("click", function () {
                $(".options-table tr").removeClass("selected");
                $(this).addClass("selected");
                $("#next-question").prop("disabled", false);
            });
    
            $tbody.append($row);
        });
    
        $table.append($tbody);
        container.append($table);
    }
    
    // Questions data structure
   
// Questions data structure
const questions = [
   // Randomized JavaScript Code for 14 Questions

// Pair 6 (Time-Limit Version): Art Exhibit
{
    id: 12,
    text: "Q12. Sponsors are asking for an immediate decision on the main highlight for an upcoming cultural event:",
    headers: ["Category", "Description", "Cost", "Audience Appeal"],
    options: [
        ["Light Projections", "Immersive light and sound shows", "₹15 Lakh", "Very High"],
        ["Interactive Installations", "Live painting and wall art creation", "₹10 Lakh", "High"],
        ["Augmented Reality", "AR stations for children and families", "₹12 Lakh", "High"],
        ["Musical Performances", "Music synced with visuals", "₹20 Lakh", "Very High"],
        ["Eco-Friendly Art", "Exhibits using recycled materials", "₹8 Lakh", "Medium"],
        ["Cultural Artifacts", "Historical displays from local traditions", "₹7 Lakh", "Medium"]
    ],
    displayType: "table",
    background: "#ff0000",
    timeLimit: 50
},

// Pair 1 (Time-Free Version): Financial Bonus
{
    id: 1,
    text: "Q1. You have received a one-time bonus of ₹50,000. Decide how to allocate it for maximum benefit:",
    options: [
        "Invest the full amount in a fixed deposit for long-term savings.",
        "Divide the bonus equally between savings and family expenses.",
        "Use the bonus to repay an ongoing debt.",
        "Spend the bonus on buying essential work tools for personal improvement."
    ],
    displayType: "normal",
    background: "#fdee98",
    timeLimit: 0
},

// Pair 4 (Time-Limit Version): Startup Funding
{
    id: 8,
    text: "Q8. You are asked to recommend one startup proposal to an investment committee:",
    options: [
        "An app development company with recent success.",
        "A medical device company solving unique health issues.",
        "A clean energy manufacturer specializing in solar panels.",
        "A local e-commerce platform serving remote areas."
    ],
    displayType: "normal",
    background: "#ff0000",
    timeLimit: 50
},

// Pair 3 (Time-Free Version): Disaster Relief
{
    id: 3,
    text: "Q3. You are planning disaster relief resource allocation. Compare the options:",
    headers: ["Region", "Population", "Urgency", "Accessibility", "Resources Needed"],
    options: [
        ["Urban Area", "High", "High", "Easy", "Food and medical aid"],
        ["Rural Area", "Moderate", "Very High", "Hard", "Water and rescue"],
        ["Coastal Region", "Low", "Moderate", "Very Hard", "Temporary shelters"],
        ["Mountainous Area", "Moderate", "High", "Very Hard", "Rescue equipment"]
    ],
    displayType: "table",
    background: "#fdee98",
    timeLimit: 0
},

// Pair 5 (Time-Limit Version): Healthcare
{
    id: 10,
    text: "Q10. A medical emergency has been reported after an epidemic outbreak in a remote village. Choose the most urgent priority:",
    headers: ["Category", "Description", "Urgency", "Cost"],
    options: [
        ["Mobile Vans", "Deploy medical vans immediately", "High", "₹10 Cr"],
        ["Emergency Hospitals", "Set up temporary shelter hospitals", "Very High", "₹20 Cr"],
        ["Food & Water", "Provide essential supplies", "Medium", "₹5 Cr"],
        ["Transport", "Shift critical patients to cities", "High", "₹12 Cr"],
        ["Manpower", "Recruit additional doctors/nurses", "High", "₹15 Cr"],
        ["Awareness Campaign", "Spread health education", "Low", "₹3 Cr"]
    ],
    displayType: "table",
    background: "#ff0000",
    timeLimit: 60
},

// Pair 7 (Time-Free Version): Research Grants
{
    id: 13,
    text: "Q13. You are reviewing proposals for a research grant program. Select the most impactful project:",
    options: [
        "Research on combating climate change in urban areas.",
        "Development of AI to improve education in rural schools.",
        "Exploration of clean energy alternatives.",
        "Genomics research for personalized medicine."
    ],
    displayType: "normal",
    background: "#fdee98",
    timeLimit: 0
},

// Pair 2 (Time-Limit Version): Mentorship
{
    id: 7,
    text: "Q7. You are at a networking event and must quickly approach one individual as a potential mentor:",
    options: [
        "A senior manager with years of experience.",
        "An entrepreneur with recent successful ventures.",
        "A professor with deep theoretical knowledge.",
        "A motivational speaker with energy and enthusiasm."
    ],
    displayType: "normal",
    background: "#ff0000",
    timeLimit: 50
},

// Pair 6 (Time-Free Version): Art Exhibit
{
    id: 11,
    text: "Q11. You are curating an art exhibit and must select installations based on creativity and audience engagement:",
    headers: ["Category", "Description", "Uniqueness", "Popularity"],
    options: [
        ["Interactive Art", "Sculptures promoting social messages", "High", "Medium"],
        ["Multimedia Art", "Visual and sound experiences", "Very High", "High"],
        ["Recycled Materials", "Installations made from waste", "Medium", "Medium"],
        ["Traditional Art", "Cultural artifacts from rural areas", "High", "Medium"],
        ["Futuristic Holograms", "Hologram-based immersive displays", "Very High", "High"]
    ],
    displayType: "table",
    background: "#fdee98",
    timeLimit: 0
},

// Pair 1 (Time-Limit Version): Financial Bonus
{
    id: 2,
    text: "Q2. Your employer gives you ₹50,000 as a surprise bonus, with the condition to spend it all by the end of the day. What do you do?",
    options: [
        "Buy new electronics for personal or work use.",
        "Host a celebration dinner for family and friends.",
        "Donate the amount to a well-known charity.",
        "Pay off small, pending bills or debts."
    ],
    displayType: "normal",
    background: "#ff0000",
    timeLimit: 60
},

// Pair 3 (Time-Limit Version): Disaster Relief
{
    id: 4,
    text: "Q4. A natural disaster occurs, and urgent decisions are required to allocate resources:",
    headers: ["Region", "Population", "Urgency", "Resources Needed", "Accessibility"],
    options: [
        ["Region A", "Very High", "Critical", "Medical teams", "Easy"],
        ["Region B", "Moderate", "High", "Food supplies", "Moderate"],
        ["Region C", "Low", "Moderate", "Water tanks", "Hard"],
        ["Region D", "High", "Very High", "Temporary housing", "Easy"]
    ],
    displayType: "table",
    background: "#ff0000",
    timeLimit: 60
},

// Pair 5 (Time-Free Version): Healthcare
{
    id: 9,
    text: "Q9. You are planning the budget for improving the healthcare system in rural areas. Where will you focus most of the funding?",
    headers: ["Category", "Description", "Impact", "Cost"],
    options: [
        ["Primary Care", "Construct healthcare centers", "High", "₹20 Cr"],
        ["Training", "Hire and train doctors/nurses", "Moderate", "₹10 Cr"],
        ["Equipment", "Provide advanced surgical tools", "High", "₹25 Cr"],
        ["Ambulance Services", "Increase ambulance services", "Medium", "₹15 Cr"],
        ["Prevention", "Launch vaccination programs", "Low", "₹5 Cr"]
    ],
    displayType: "table",
    background: "#fdee98",
    timeLimit: 0
},

// Pair 7 (Time-Limit Version): Research Grants
{
    id: 14,
    text: "Q14. The grant committee is split, and you must make the final decision on funding one project:",
    options: [
        "AI-based education models for underserved communities.",
        "Research on gene editing for cancer treatments.",
        "Development of sustainable farming technologies.",
        "Quantum computing advancements for secure communications."
    ],
    displayType: "normal",
    background: "#ff0000",
    timeLimit: 50
},

// Pair 4 (Time-Free Version): Startup Funding
{
    id: 6,
    text: "Q6. You are reviewing startup proposals to select the most promising investment:",
    options: [
        "A tech company developing innovative AI tools.",
        "A healthcare startup targeting rural areas.",
        "A green energy company focused on sustainability.",
        "A luxury goods company with niche market appeal."
    ],
    displayType: "normal",
    background: "#fdee98",
    timeLimit: 0
}
];

    let currentQuestion = 0;
    let responses = {
        basicInfo: {},
        questions: {
            timefree:[],
            timebound:[]
        },
        likertScales: [],
        stressAssessment: {}
    };

    let currentTimer = null;
});