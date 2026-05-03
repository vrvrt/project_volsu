import os
import httpx
import json
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("DEEPSEEK_API_KEY")
API_URL = "https://api.deepseek.com/chat/completions"

async def evaluate_answer(ideal_answer: str, student_answer: str, question: str) -> dict:
    prompt = f"""Ты — строгий и справедливый педагогический ассистент.
    
Вопрос: {question}

Эталонный ответ преподавателя: {ideal_answer}

Ответ ученика: {student_answer}

Оцени ответ ученика. Верни ТОЛЬКО валидный JSON без пояснений:
{{
    "score": <число от 0 до 100>,
    "feedback": "<конкретный комментарий что верно, что нет и что улучшить>"
}}"""

    async with httpx.AsyncClient() as client:
        response = await client.post(
            API_URL,
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "deepseek-chat",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0
            },
            timeout=30
        )
    
    # Печатаем полный ответ для отладки
    print("DeepSeek status:", response.status_code)
    print("DeepSeek body:", response.text)
    
    result = response.json()
    
    # Проверяем есть ли ошибка
    if "error" in result:
        print("DeepSeek error:", result["error"])
        return {"score": 0, "feedback": f"Ошибка API: {result['error']}"}
    
    if "choices" not in result:
        print("Unexpected response:", result)
        return {"score": 0, "feedback": "Неожиданный ответ от API"}
    
    content = result["choices"][0]["message"]["content"]
    content = content.strip()
    
    # Убираем markdown если модель добавила ```json
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
        content = content.strip()
    
    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        print("JSON parse error:", e)
        print("Raw content:", content)
        return {"score": 0, "feedback": "Ошибка разбора ответа модели"}