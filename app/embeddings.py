from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
client = OpenAI()

MODEL = "text-embedding-3-small"


def embed_texts(texts: list[str], batch_size: int = 100) -> list[list[float]]:
    vectors: list[list[float]] = []
    for i in range(0, len(texts), batch_size):
        res = client.embeddings.create(model=MODEL, input=texts[i:i + batch_size])
        vectors.extend(d.embedding for d in res.data)
    return vectors