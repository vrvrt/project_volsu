from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from models import TestCreate, SubmitTest
import database as db
import llm

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

app.mount("/static", StaticFiles(directory="../frontend"), name="static")

@app.get("/ping")
def ping():
    return {"status": "ok"}

@app.post("/api/tests")
async def create_test(data: TestCreate):
    test = db.create_test(data.title, data.max_attempts)
    for q in data.questions:
        db.add_question(test["id"], q.question_text, q.ideal_answer, q.order_num)
    return {"test_id": test["id"], "title": test["title"], "max_attempts": test["max_attempts"]}

@app.get("/api/tests/{test_id}")
async def get_test(test_id: str):
    test = db.get_test(test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")
    questions = db.get_questions(test_id)
    return {
        "test_id": test_id,
        "title": test["title"],
        "max_attempts": test["max_attempts"],
        "questions": [{"id": q["id"], "question_text": q["question_text"]} for q in questions]
    }

@app.post("/api/submit")
async def submit_test(data: SubmitTest):
    # Проверяем количество попыток
    test = db.get_test(data.test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")

    attempts_used = db.get_attempt_count(data.test_id, data.student_name, data.group_name)
    max_attempts = test.get("max_attempts", 1)

    if attempts_used >= max_attempts:
        raise HTTPException(
            status_code=403,
            detail=f"Превышено количество попыток. Разрешено: {max_attempts}"
        )

    questions = db.get_questions(data.test_id)
    questions_map = {q["id"]: q for q in questions}

    results = []
    for answer in data.answers:
        q_id = answer["question_id"]
        q = questions_map.get(q_id)
        if not q:
            continue

        evaluation = await llm.evaluate_answer(
            ideal_answer=q["ideal_answer"],
            student_answer=answer["answer_text"],
            question=q["question_text"]
        )

        db.save_answer(
            test_id=data.test_id,
            student_name=data.student_name,
            group_name=data.group_name,
            question_id=q_id,
            answer_text=answer["answer_text"],
            score=evaluation["score"],
            feedback=evaluation["feedback"]
        )

        results.append({
            "question": q["question_text"],
            "score": evaluation["score"],
            "feedback": evaluation["feedback"]
        })

    # Логируем попытку
    db.log_attempt(data.test_id, data.student_name, data.group_name, attempts_used + 1)

    avg_score = sum(r["score"] for r in results) / len(results) if results else 0

    return {
        "student_name": data.student_name,
        "avg_score": round(avg_score, 1),
        "attempts_used": attempts_used + 1,
        "attempts_left": max_attempts - attempts_used - 1,
        "results": results
    }

@app.get("/api/results/{test_id}")
async def get_results(test_id: str):
    results = db.get_results(test_id)
    return {"results": results}
@app.delete("/api/questions/{question_id}")
async def delete_question(question_id: str):
    db.delete_question(question_id)
    return {"status": "deleted"}

@app.post("/api/tests/{test_id}/questions")
async def add_questions_to_test(test_id: str, data: dict):
    test = db.get_test(test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")
    existing = db.get_questions(test_id)
    max_order = max((q["order_num"] for q in existing), default=0)
    db.update_test_questions(test_id, data["questions"], max_order)
    return {"status": "ok"}