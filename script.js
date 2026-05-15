const API = "https://project-volsu.onrender.com";

// ─── ВКЛАДКИ ─────────────────────────────────────
function showTab(name, el) {
    document.getElementById("tab-create").classList.add("hidden");
    document.getElementById("tab-edit").classList.add("hidden");
    document.getElementById("tab-results").classList.add("hidden");
    document.getElementById(`tab-${name}`).classList.remove("hidden");
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    if (el) el.classList.add("active");
    if (name === "edit") renderSavedTests();
}

// ─── ПРЕПОДАВАТЕЛЬ: СОЗДАТЬ ТЕСТ ─────────────────

let questionCount = 0;

function addQuestion() {
    questionCount++;
    const container = document.getElementById("questions");
    const div = document.createElement("div");
    div.className = "question-block";
    div.id = `q-${questionCount}`;
    div.innerHTML = `
        <button class="delete-btn" onclick="deleteQuestion(${questionCount})">✕ Удалить</button>
        <p><strong>Вопрос ${questionCount}</strong></p>
        <input type="text" placeholder="Текст вопроса" id="qtext-${questionCount}">
        <textarea placeholder="Эталонный ответ" id="qanswer-${questionCount}"></textarea>
    `;
    container.appendChild(div);
}

function deleteQuestion(num) {
    const el = document.getElementById(`q-${num}`);
    if (el) el.remove();
}

async function saveTest() {
    const title = document.getElementById("testTitle").value.trim();
    const maxAttempts = parseInt(document.getElementById("maxAttempts").value) || 1;
    if (!title) { alert("Введи название опроса"); return; }

    const questions = [];
    let order = 1;
    for (let i = 1; i <= questionCount; i++) {
        const textEl = document.getElementById(`qtext-${i}`);
        const answerEl = document.getElementById(`qanswer-${i}`);
        if (!textEl) continue;
        const text = textEl.value.trim();
        const answer = answerEl.value.trim();
        if (text && answer) {
            questions.push({ question_text: text, ideal_answer: answer, order_num: order++ });
        }
    }

    if (questions.length === 0) { alert("Добавь хотя бы один вопрос"); return; }

    const response = await fetch(`${API}/api/tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, max_attempts: maxAttempts, questions })
    });

    const data = await response.json();

    const msg = document.getElementById("message");
    msg.classList.remove("hidden");
    msg.innerHTML = `Опрос создан! ID: <strong>${data.test_id}</strong> — передай этот ID ученикам`;
}

// ─── ПРЕПОДАВАТЕЛЬ: РЕЗУЛЬТАТЫ ────────────────────

function getBadgeClass(score) {
    if (score >= 70) return "high";
    if (score >= 40) return "mid";
    return "low";
}

function getColor(score) {
    if (score >= 70) return "#27ae60";
    if (score >= 40) return "#f39c12";
    return "#e74c3c";
}

async function loadResults() {
    const testId = document.getElementById("resultTestId").value.trim();
    if (!testId) { alert("Введи ID опроса"); return; }

    const response = await fetch(`${API}/api/results/${testId}`);
    const data = await response.json();

    if (!data.results || data.results.length === 0) {
        alert("Результатов пока нет");
        return;
    }

    const testResponse = await fetch(`${API}/api/tests/${testId}`);
    const testData = await testResponse.json();
    const questionsMap = {};
    testData.questions.forEach(q => { questionsMap[q.id] = q.question_text; });

    const byStudent = {};
    data.results.forEach(r => {
        const key = `${r.student_name}__${r.group_name}`;
        if (!byStudent[key]) byStudent[key] = { name: r.student_name, group: r.group_name, answers: [] };
        byStudent[key].answers.push(r);
    });

    const students = Object.values(byStudent);

    const allScores = data.results.map(r => r.score);
    const avgAll = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    const maxScore = Math.max(...allScores);
    const minScore = Math.min(...allScores);
    const above70 = students.filter(s => {
        const avg = s.answers.reduce((a, b) => a + b.score, 0) / s.answers.length;
        return avg >= 70;
    }).length;

    const byQuestion = {};
    data.results.forEach(r => {
        if (!byQuestion[r.question_id]) byQuestion[r.question_id] = [];
        byQuestion[r.question_id].push(r.score);
    });

    document.getElementById("summary").classList.remove("hidden");
    document.getElementById("summary-cards").innerHTML = `
        <div class="stat-card">
            <div class="number">${students.length}</div>
            <div class="label">Учеников сдали</div>
        </div>
        <div class="stat-card">
            <div class="number" style="color:${getColor(avgAll)}">${avgAll.toFixed(1)}</div>
            <div class="label">Средний балл</div>
        </div>
        <div class="stat-card">
            <div class="number" style="color:#27ae60">${maxScore}</div>
            <div class="label">Лучший балл</div>
        </div>
        <div class="stat-card">
            <div class="number" style="color:#e74c3c">${minScore}</div>
            <div class="label">Худший балл</div>
        </div>
        <div class="stat-card">
            <div class="number">${above70}</div>
            <div class="label">Выше 70 баллов</div>
        </div>
    `;

    if (window.chartScoresInstance) window.chartScoresInstance.destroy();
    if (window.chartQuestionsInstance) window.chartQuestionsInstance.destroy();

    const studentAvgs = students.map(s =>
        Math.round(s.answers.reduce((a, b) => a + b.score, 0) / s.answers.length)
    );

    const buckets = { "0-40": 0, "41-60": 0, "61-80": 0, "81-100": 0 };
    studentAvgs.forEach(score => {
        if (score <= 40) buckets["0-40"]++;
        else if (score <= 60) buckets["41-60"]++;
        else if (score <= 80) buckets["61-80"]++;
        else buckets["81-100"]++;
    });

    window.chartScoresInstance = new Chart(
        document.getElementById("chartScores"),
        {
            type: "bar",
            data: {
                labels: Object.keys(buckets),
                datasets: [{
                    label: "Учеников",
                    data: Object.values(buckets),
                    backgroundColor: ["#e74c3c", "#f39c12", "#3498db", "#27ae60"],
                    borderRadius: 6
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        }
    );

    const qLabels = Object.keys(byQuestion).map((qid, i) => `Вопрос ${i + 1}`);
    const qAvgs = Object.values(byQuestion).map(scores =>
        parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
    );

    window.chartQuestionsInstance = new Chart(
        document.getElementById("chartQuestions"),
        {
            type: "bar",
            data: {
                labels: qLabels,
                datasets: [{
                    label: "Средний балл",
                    data: qAvgs,
                    backgroundColor: qAvgs.map(v =>
                        v >= 70 ? "#27ae60" : v >= 40 ? "#f39c12" : "#e74c3c"
                    ),
                    borderRadius: 6
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, max: 100 } }
            }
        }
    );

    document.getElementById("questions-stats").innerHTML = `
        <h3 style="margin-bottom:10px;">Детали по вопросам</h3>
        ${Object.entries(byQuestion).map(([qid, scores], i) => {
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            const qText = questionsMap[qid] || `Вопрос ${i + 1}`;
            return `
                <div class="question-stat">
                    <div style="display:flex; justify-content:space-between;">
                        <span>${qText}</span>
                        <strong style="color:${getColor(avg)}">${avg.toFixed(1)}</strong>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill"
                             style="width:${avg}%; background:${getColor(avg)};"></div>
                    </div>
                </div>
            `;
        }).join("")}
    `;

    document.getElementById("students").classList.remove("hidden");
    document.getElementById("students-list").innerHTML = students.map(student => {
        const avg = student.answers.reduce((s, a) => s + a.score, 0) / student.answers.length;
        return `
            <div class="student-card">
                <div class="student-header">
                    <div>
                        <span class="student-name">${student.name}</span>
                        <span class="student-group" style="margin-left:10px;">
                            ${student.group}
                        </span>
                    </div>
                    <span class="badge ${getBadgeClass(avg)}">
                        ${avg.toFixed(1)} / 100
                    </span>
                </div>
                ${student.answers.map(a => `
                    <div class="answer-row">
                        <div class="q-text">
                            <div>${questionsMap[a.question_id] || "Вопрос"}</div>
                            <div style="color:#999; font-size:12px; margin-top:3px;">
                                ${a.feedback}
                            </div>
                        </div>
                        <div class="q-score" style="color:${getColor(a.score)}">${a.score}</div>
                    </div>
                `).join("")}
            </div>
        `;
    }).join("");
}

// ─── УЧЕНИК ──────────────────────────────────────

let currentTest = null;

async function startTest() {
    const testId = document.getElementById("testId").value.trim();
    const studentName = document.getElementById("studentName").value.trim();
    const groupName = document.getElementById("groupName").value.trim();

    if (!testId || !studentName || !groupName) {
        alert("Заполни все поля");
        return;
    }

    const response = await fetch(`${API}/api/tests/${testId}`);
    if (!response.ok) { alert("Опрос не найден"); return; }

    currentTest = await response.json();
    currentTest.studentName = studentName;
    currentTest.groupName = groupName;

    document.getElementById("testTitle").textContent = currentTest.title;

    const container = document.getElementById("questions");
    container.innerHTML = currentTest.questions.map((q, i) => `
        <div class="question-block">
            <p><strong>Вопрос ${i + 1}:</strong> ${q.question_text}</p>
            <textarea placeholder="Твой ответ" id="answer-${q.id}"></textarea>
        </div>
    `).join("");

    document.getElementById("screen-start").classList.add("hidden");
    document.getElementById("screen-test").classList.remove("hidden");
}

async function submitTest() {
    const answers = currentTest.questions.map(q => ({
        question_id: q.id,
        answer_text: document.getElementById(`answer-${q.id}`).value.trim()
    }));

    if (answers.some(a => !a.answer_text)) {
        alert("Ответь на все вопросы");
        return;
    }

    const screenTest = document.getElementById("screen-test");
    screenTest.innerHTML = `
        <div style="text-align:center; padding:40px;">
            <p style="font-size:18px;">⏳ Проверяем ответы...</p>
            <p style="color:#777; margin-top:10px;">Это займёт несколько секунд</p>
        </div>
    `;

    try {
        const response = await fetch(`${API}/api/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                test_id: currentTest.test_id,
                student_name: currentTest.studentName,
                group_name: currentTest.groupName,
                answers
            })
        });

        if (!response.ok) {
            const error = await response.json();
            screenTest.innerHTML = `
                <div style="text-align:center; padding:40px;">
                    <p style="font-size:24px;">🚫</p>
                    <p style="font-size:18px; color:#e74c3c; margin-top:10px;">
                        ${error.detail || "Ошибка при отправке"}
                    </p>
                    <button onclick="location.reload()" style="margin-top:20px;">
                        Вернуться назад
                    </button>
                </div>
            `;
            return;
        }

        const data = await response.json();

        document.getElementById("avgScore").textContent = data.avg_score;
        document.getElementById("avgScore").style.color = getColor(data.avg_score);

        const attemptsInfo = data.attempts_left > 0
            ? `<p style="color:#777; margin-top:5px;">Осталось попыток: ${data.attempts_left}</p>`
            : `<p style="color:#e74c3c; margin-top:5px;">Попытки исчерпаны</p>`;

        const container = document.getElementById("results");
        container.innerHTML = attemptsInfo + data.results.map((r, i) => `
            <div class="result-block">
                <p><strong>Вопрос ${i + 1}:</strong> ${r.question}</p>
                <p>Балл: <span style="font-weight:bold; color:${getColor(r.score)}">${r.score}</span></p>
                <p class="feedback">${r.feedback}</p>
            </div>
        `).join("");

        screenTest.classList.add("hidden");
        document.getElementById("screen-results").classList.remove("hidden");

    } catch (err) {
        screenTest.innerHTML = `
            <div style="text-align:center; padding:40px;">
                <p style="font-size:18px; color:#e74c3c;">Ошибка соединения с сервером</p>
                <button onclick="location.reload()" style="margin-top:20px;">
                    Попробовать снова
                </button>
            </div>
        `;
    }
}

// ─── РЕДАКТИРОВАНИЕ ТЕСТА ─────────────────────────

let editTestId = null;
let editQuestionCount = 0;

async function loadTestForEdit() {
    const id = document.getElementById("editTestId").value.trim();
    if (!id) { alert("Введи ID опроса"); return; }

    const response = await fetch(`${API}/api/tests/${id}`);
    if (!response.ok) { alert("Опрос не найден"); return; }

    const data = await response.json();
    editTestId = id;
    editQuestionCount = 0;

    document.getElementById("edit-test-title-input").value = data.title;
    document.getElementById("edit-max-attempts").value = data.max_attempts;

    document.getElementById("edit-questions-list").innerHTML = data.questions.map(q => `
        <div class="question-block" id="eq-${q.id}">
            <button class="delete-btn" onclick="deleteExistingQuestion('${q.id}')">
                ✕ Удалить
            </button>
            <p><strong>${q.question_text}</strong></p>
        </div>
    `).join("");

    document.getElementById("edit-new-questions").innerHTML = "";
    document.getElementById("edit-content").classList.remove("hidden");
}

async function deleteExistingQuestion(questionId) {
    if (!confirm("Удалить вопрос?")) return;

    const response = await fetch(`${API}/api/questions/${questionId}`, {
        method: "DELETE"
    });

    if (response.ok) {
        document.getElementById(`eq-${questionId}`).remove();
    } else {
        alert("Ошибка при удалении");
    }
}

function addEditQuestion() {
    editQuestionCount++;
    const container = document.getElementById("edit-new-questions");
    const div = document.createElement("div");
    div.className = "question-block";
    div.id = `neq-${editQuestionCount}`;
    div.innerHTML = `
        <button class="delete-btn" onclick="this.parentElement.remove()">✕</button>
        <p><strong>Новый вопрос ${editQuestionCount}</strong></p>
        <input type="text" placeholder="Текст вопроса" id="neq-text-${editQuestionCount}">
        <textarea placeholder="Эталонный ответ" id="neq-answer-${editQuestionCount}"></textarea>
    `;
    container.appendChild(div);
}

async function saveNewQuestions() {
    const newQuestions = [];
    let order = 1;

    document.querySelectorAll("[id^='neq-text-']").forEach(input => {
        const num = input.id.replace("neq-text-", "");
        const text = input.value.trim();
        const answer = document.getElementById(`neq-answer-${num}`).value.trim();
        if (text && answer) {
            newQuestions.push({ question_text: text, ideal_answer: answer, order_num: order++ });
        }
    });

    if (newQuestions.length === 0) { alert("Нет новых вопросов для сохранения"); return; }

    const response = await fetch(`${API}/api/tests/${editTestId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: newQuestions })
    });

    if (response.ok) {
        alert("Вопросы добавлены");
        loadTestForEdit();
    } else {
        alert("Ошибка при сохранении");
    }
}

async function renderSavedTests() {
    const container = document.getElementById("saved-tests-list");
    container.innerHTML = "<p style='color:#999; font-size:13px;'>Загрузка...</p>";

    const response = await fetch(`${API}/api/tests`);
    const data = await response.json();

    if (!data.tests || data.tests.length === 0) {
        container.innerHTML = "<p style='color:#999; font-size:13px;'>Пока нет тестов</p>";
        return;
    }

    container.innerHTML = data.tests.map(t => `
        <div style="display:flex; align-items:center; gap:15px; padding:8px 12px;
                    background:#f9f9f9; border-radius:6px; margin-bottom:8px;">
            <div style="flex:1;">
                <strong>${t.title}</strong>
                <span style="color:#999; font-size:12px; margin-left:10px;">
                    ${new Date(t.created_at).toLocaleDateString()}
                </span>
            </div>
            <code style="background:#eee; padding:3px 8px; border-radius:4px; font-size:13px;">
                ${t.id}
            </code>
            <button onclick="selectTest('${t.id}')" style="padding:4px 12px; font-size:13px;">
                Загрузить
            </button>
        </div>
    `).join("");
}

function selectTest(id) {
    document.getElementById("editTestId").value = id;
    loadTestForEdit();
}

async function saveMaxAttempts() {
    const val = parseInt(document.getElementById("edit-max-attempts").value) || 1;
    const response = await fetch(`${API}/api/tests/${editTestId}/attempts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_attempts: val })
    });
    if (response.ok) alert("Сохранено");
    else alert("Ошибка");
}
document.addEventListener("paste", function(e) {
    if (e.target.tagName === "TEXTAREA") {
        e.preventDefault();
    }
});

document.addEventListener("copy", function(e) {
    if (e.target.tagName === "TEXTAREA") {
        e.preventDefault();
    }
});