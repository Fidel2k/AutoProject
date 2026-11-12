"""Read local settings from backend/.env; shell variables take precedence."""
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
BACKEND_DIR = Path(__file__).resolve().parent.parent
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / '.env', extra='ignore')
    database_url: str = 'mysql+pymysql://autoparts:local-demo-password@127.0.0.1:3306/autoparts'
    cors_origins: str = 'http://localhost:5173,http://127.0.0.1:5173'
settings = Settings()
