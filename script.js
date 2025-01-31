$(document).ready(function () {
    // Add audio element for tick sound
    const tickSound = new Audio('ticking-clock.mp3.mp3');
    tickSound.volume = 0.5; // Adjust volume to 50%
    
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

    // Timer class with tick sound
    class Timer {
        constructor(duration = 0, onComplete) {
            this.duration = duration;
            this.remaining = duration;
            this.onComplete = onComplete;
            this.isRunning = false;
            this.isTickingStarted = false;
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
                // Stop the ticking sound if it's playing
                if (this.isTickingStarted) {
                    tickSound.pause();
                    tickSound.currentTime = 0;
                    this.isTickingStarted = false;
                }
                return this.getElapsedTime();
            }
            return 0;
        }

        update() {
            if (this.duration > 0) {
                this.remaining = Math.max(0, this.duration - Math.floor((Date.now() - this.startTime) / 1000));
                $("#time-value").text(this.remaining);

                // Start ticking when 10 seconds or less remain
                if (this.remaining <= 10 && !this.isTickingStarted) {
                    this.isTickingStarted = true;
                    tickSound.play();
                    // Set up looping for the tick sound
                    tickSound.addEventListener('ended', function() {
                        if (this.remaining > 0) {
                            this.currentTime = 0;
                            this.play();
                        }
                    });
                }

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

    // Rest of your existing code remains exactly the same...
    // [... Rest of the existing code ...]

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

// Q13: Research Grants (Time-Free)
{
    id: 13,
    text: "Q13. As a member of the selection committee, you are responsible for awarding a research grant to the project with the highest potential impact. Carefully evaluate the options and choose the most deserving one.",
    options: [
        " Strategies to mitigate climate change in urban environments.",
        "AI-driven solutions to improve education in rural areas.",
        "Research on alternative clean energy sources.",
        "Genomics advancements for personalized medical treatments."
    ],
    displayType: "normal",
    background: "#fdee98",
    timeLimit: 0
},

// Q4: Disaster Relief (Time-Limit)
{
    id: 4,
    text: "Q4. A natural disaster has struck, and you must decide where to send resources first. Which region will you choose?",
    headers: ["Region", "People Affected", "Urgency Level", "Main Need", "Ease of Access"],
    options: [
        ["Region A", "Very Large Population", "Critical (Life-threatening)", "Emergency Medical Help", "Easily Accessible"],
        ["Region B", "Medium Population", "High (Serious Concern)", "Food Supplies", "Moderately Accessible"],
        ["Region C", "Small Population", "Moderate (Can Wait)", "Clean Water Supply", "Hard to Reach"],
        ["Region D", "Large Population", "Very High (Urgent)", "Temporary Shelter", "Easily Accessible"]
    ],
    displayType: "table",
    background: "#ff0000",
    timeLimit: 75
},

// Q8: Startup Funding (Time-Limit)
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

// Q3: Disaster Relief (Time-Free)
{
    id: 3,
    text: "Q3. You are a member of rescue team, there is a house on fire unfortunately a child is still inside the house, what do you do?",
    headers: [ "Action", "Risk Level", "Response Speed", "Team Coordination", "Effectiveness"],
    options: [
        [ "Enter the burning house without any second thought", "Very High", "Very Fast", "Low", "Uncertain (high risk to rescuer)"],
        [ "Take a few seconds to assess the situation then decide", "Moderate", "Moderate", "Medium", "High (better situational awareness)"],
        [ "Inform the other team members on call", "Low", "Slow", "High", "Moderate (delays immediate action)"],
        [ "Do not enter until you find help", "Low", "Very Slow", "High", "Low (delays rescue significantly)"]
    ],
    displayType: "table",
    background: "#fdee98",
    timeLimit: 0
},

// Q11: Art Exhibit (Time-Free)
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

// Q2: Financial Bonus (Time-Limit)
{
    id: 2,
    text: "Q2. Your employer gives you ₹1Lakh as a surprise bonus, with the condition to spend it all by the end of the day. What do you do?",
    options: [
        "Buy something you wished to buy since a long time.",
        "invest it in stocks or mutual funds.",
        "Donate the amount to a well-known charity.",
        "Take out an insurance policy."
    ],
    displayType: "normal",
    background: "#ff0000",
    timeLimit: 50
},

// Q7: Mentorship (Time-Limit)
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

// Q14: Research Grants (Time-Limit)
{
    id: 14,
    text: "Q14.Your company has decided to fund a project and you must make the final decision. Choose the most profitable project.",
    options: [
        "AI-powered education models for underserved communities.",
        "Gene-editing research for innovative cancer treatments.",
        "Sustainable farming technologies for food security and environmental benefits.",
        "Quantum computing advancements for secure communication."
    ],
    displayType: "normal",
    background: "#ff0000",
    timeLimit: 50
},

// Q5: Mentorship (Time-Free)
{
    id: 5,
    text: "Q5. You are selecting a career mentor for a year-long program. Choose the mentor based on your goals:",
    options: [
        "A highly experienced industry expert but with limited availability.",
        "A coach with moderate experience but offering frequent sessions.",
        "A university professor with excellent academic insights but no industry exposure.",
        "A rising professional known for innovative approaches."
    ],
    displayType: "normal",
    background: "#fdee98",
    timeLimit: 0
},

// Q10: Healthcare System (Time-Limit)
{
    id: 10,
    text: "Q10. Your team is facing a disagreement on how to solve a critical problem, and everyone is looking to you for the final decision. What would you do?",
    headers: ["Decision Approach", "Pros", "Cons", "Effectiveness"],
    options: [
        ["Hold a quick vote but allow time for discussion", "Encourages participation & fairness", "Might not always lead to the best solution", "Moderate"],
        ["Consult an expert or senior leader before deciding", "Brings in experienced insight", "May reduce team autonomy", "High"],
        ["Assign a small group to evaluate and suggest the best option", "Ensures thorough analysis", "Can slow down the process", "Moderate"],
        ["Set a time limit for discussion and make a firm decision", "Keeps things efficient", "Risk of missing important details", "Medium"]
    ],
    displayType: "table",
    background: "#ff0000",
    timeLimit: 75
},

// Q1: Financial Bonus (Time-Free)
{
    id: 1,
    text: "Q1. You have received a one-time bonus of ₹50,000. Decide how you use it for maximum benefit:",
    options: [
        "Invest the full amount in a fixed deposit for long-term savings.",
        "Divide the bonus equally between savings and family expenses.",
        "Use the bonus to repay an ongoing loan.",
        "Spend the bonus on buying essential work tools for personal improvement."
    ],
    displayType: "normal",
    background: "#fdee98",
    timeLimit: 0
},

// Q6: Startup Funding (Time-Free)
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
},

// Q9: Healthcare System (Time-Free)
{
    id: 9,
    text: "Q9. Your team disagrees on how to solve a problem, and everyone is looking to you for the final decision. What should you do?",
    headers: ["Decision Approach", "Pros", "Cons", "Effectiveness"],
    options: [
        ["Go with the majority opinion to maintain harmony", "Quick resolution, avoids conflict", "Might overlook better solutions", "Moderate"],
        ["Consider all perspectives, seek more input if needed, then decide", "Ensures a well-balanced decision, promotes fairness", "Takes more time", "High"],
        ["Stay neutral and let the team sort it out", "Avoids personal bias", "Can lead to delays and unresolved issues", "Low"],
        ["Choose the first suggestion to save time", "Fastest way to move forward", "May result in poor decision-making", "Low"]
    ],
    displayType: "table",
    background: "#fdee98",
    timeLimit: 0
},

// Q12: Art Exhibit (Time-Limit)
{
    id: 12,
    text: "Q12. Sponsors are asking for an immediate decision on the main highlight for an upcoming cultural event what you will choose:",
    headers: ["Category", "Description", "Cost", "Audience Appeal"],
    options: [
        ["Interactive Installations", "Live painting and wall art creation", "₹10 Lakh", "Very High"],
        ["Augmented Reality", "AR stations for children and families", "₹12 Lakh", "High"],
        ["Musical Performances", "Music synced with visuals", "₹20 Lakh", "Low"],
        ["Eco-Friendly Art", "Exhibits using recycled materials", "₹8 Lakh", "Medium"],
        ["Cultural Artifacts", "Historical displays from local traditions", "₹7 Lakh", "Medium"]
    ],
    displayType: "table",
    background: "#ff0000",
    timeLimit: 75  
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
