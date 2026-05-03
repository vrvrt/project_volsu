from pydantic import BaseModel
from typing import List, Optional

class Question(BaseModel):
    question_text: str
    ideal_answer: str
    order_num: int

class TestCreate(BaseModel):
    title: str
    max_attempts: int = 1
    questions: List[Question]

class StudentAnswer(BaseModel):
    test_id: str
    student_name: str
    group_name: str
    question_id: str
    answer_text: str

class SubmitTest(BaseModel):
    test_id: str
    student_name: str
    group_name: str
    answers: List[dict]