import sys
import os
import typer
from rich.console import Console
from rich.markdown import Markdown

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from src.ingestion.router import DocumentRouter
from src.ingestion.chunking import AdaptiveChunker
from src.retrieval.vector_store import VectorStoreManager
from src.retrieval.search_engine import SearchEngine
from src.llm.llm_client import LLMEngine
from src.llm.prompt_builder import PromptBuilder

app = typer.Typer(help="NotebookLM Mini CLI (New Architecture)")
console = Console()


@app.command()
def add(source: str, notebook_id: str = "default"):
    """Bóc tách và nạp một file hoặc URL vào Notebook."""
    with console.status(f"[bold green]Đang xử lý '{source}'...[/bold green]"):
        parser = DocumentRouter.get_parser(source)
        doc_tree = parser.parse(source)
        chunker = AdaptiveChunker(chunk_size=1000, chunk_overlap=200)
        chunks = chunker.process_document(doc_tree)
        store = VectorStoreManager(notebook_id=notebook_id)
        store.index_chunks(chunks)
    console.print(f"[bold green]✔ Hoàn tất![/bold green] Đã nạp [cyan]{len(chunks)}[/cyan] chunks vào sổ tay '{notebook_id}'.")


@app.command()
def ask(question: str, notebook_id: str = "default"):
    """Đặt câu hỏi trực tiếp trên Terminal với trích dẫn nguồn."""
    store = VectorStoreManager(notebook_id=notebook_id)
    search_engine = SearchEngine(store)
    llm = LLMEngine()

    with console.status("[bold cyan]Đang truy xuất Hybrid Search + Rerank và suy luận...[/bold cyan]"):
        retrieved_chunks = search_engine.search(query=question, top_k=5)
        prompt = PromptBuilder.build_rag_prompt(query=question, retrieved_chunks=retrieved_chunks)
        response = llm.generate(prompt)

    console.print("\n[bold blue]Trả lời:[/bold blue]")
    console.print(Markdown(response))


if __name__ == "__main__":
    app()
