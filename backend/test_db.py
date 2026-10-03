from sqlalchemy import text

from app.database import engine


try:
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        print("DATABASE CONNECTED:", result.scalar())

except Exception as e:
    print("DATABASE CONNECTION FAILED")
    print(e)