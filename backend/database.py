import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SECRET_KEY")
)

def create_test(title: str, max_attempts: int = 1):
    result = supabase.table("tests").insert({
        "title": title,
        "max_attempts": max_attempts
    }).execute()
    return result.data[0]

def add_question(test_id: str, question_text: str, ideal_answer: str, order_num: int):
    result = supabase.table("questions").insert({
        "test_id": test_id,
        "question_text": question_text,
        "ideal_answer": ideal_answer,
        "order_num": order_num
    }).execute()
    return result.data[0]

def get_test(test_id: str):
    result = supabase.table("tests").select("*").eq("id", test_id).execute()
    return result.data[0] if result.data else None

def get_questions(test_id: str):
    result = supabase.table("questions").select("*").eq("test_id", test_id).order("order_num").execute()
    return result.data

def save_answer(test_id: str, student_name: str, group_name: str,
                question_id: str, answer_text: str, score: float, feedback: str):
    result = supabase.table("student_answers").insert({
        "test_id": test_id,
        "student_name": student_name,
        "group_name": group_name,
        "question_id": question_id,
        "answer_text": answer_text,
        "score": score,
        "feedback": feedback
    }).execute()
    return result.data[0]

def get_results(test_id: str):
    result = supabase.table("student_answers").select("*").eq("test_id", test_id).execute()
    return result.data

def get_attempt_count(test_id: str, student_name: str, group_name: str) -> int:
    result = supabase.table("attempt_log").select("*")\
        .eq("test_id", test_id)\
        .eq("student_name", student_name)\
        .eq("group_name", group_name)\
        .execute()
    return len(result.data)

def log_attempt(test_id: str, student_name: str, group_name: str, attempt_num: int):
    supabase.table("attempt_log").insert({
        "test_id": test_id,
        "student_name": student_name,
        "group_name": group_name,
        "attempt_num": attempt_num
    }).execute()
def delete_question(question_id: str):
    supabase.table("student_answers").delete().eq("question_id", question_id).execute()
    supabase.table("questions").delete().eq("id", question_id).execute()

def update_test_questions(test_id: str, new_questions: list, max_order: int):
    for q in new_questions:
        supabase.table("questions").insert({
            "test_id": test_id,
            "question_text": q["question_text"],
            "ideal_answer": q["ideal_answer"],
            "order_num": max_order + q["order_num"]
        }).execute()
def get_all_tests():
    result = supabase.table("tests").select("id, title, max_attempts, created_at").order("created_at", desc=True).execute()
    return result.data
def update_test_title(test_id: str, title: str):
    supabase.table("tests").update({"title": title}).eq("id", test_id).execute()