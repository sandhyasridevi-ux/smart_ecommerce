from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_schema_columns():
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    if "products" in table_names:
        product_columns = {column["name"] for column in inspector.get_columns("products")}
        with engine.begin() as connection:
            if "category" not in product_columns:
                connection.execute(
                    text("ALTER TABLE products ADD COLUMN category VARCHAR")
                )
            if "image" not in product_columns:
                connection.execute(
                    text("ALTER TABLE products ADD COLUMN image VARCHAR")
                )
        if "popularity" not in product_columns:
            with engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE products ADD COLUMN popularity INTEGER DEFAULT 0")
                )
        if "images" not in product_columns:
            with engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE products ADD COLUMN images VARCHAR")
                )

    if "users" in table_names:
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        if "created_at" not in user_columns:
            with engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE users ADD COLUMN created_at DATETIME")
                )
                connection.execute(
                    text("UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL")
                )
        if "is_active" not in user_columns:
            with engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1")
                )
                connection.execute(
                    text("UPDATE users SET is_active = 1 WHERE is_active IS NULL")
                )

    if "orders" in table_names:
        order_columns = {column["name"] for column in inspector.get_columns("orders")}
        with engine.begin() as connection:
            if "payment_status" not in order_columns:
                connection.execute(
                    text("ALTER TABLE orders ADD COLUMN payment_status VARCHAR DEFAULT 'pending'")
                )
            if "order_status" not in order_columns:
                connection.execute(
                    text("ALTER TABLE orders ADD COLUMN order_status VARCHAR DEFAULT 'pending'")
                )
            if "created_at" not in order_columns:
                connection.execute(
                    text("ALTER TABLE orders ADD COLUMN created_at DATETIME")
                )
                connection.execute(
                    text("UPDATE orders SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL")
                )

    if "payments" in table_names:
        payment_columns = {column["name"] for column in inspector.get_columns("payments")}
        with engine.begin() as connection:
            if "payment_method" not in payment_columns:
                connection.execute(
                    text("ALTER TABLE payments ADD COLUMN payment_method VARCHAR DEFAULT 'card'")
                )
            if "transaction_id" not in payment_columns:
                connection.execute(
                    text("ALTER TABLE payments ADD COLUMN transaction_id VARCHAR")
                )
            if "status" not in payment_columns:
                connection.execute(
                    text("ALTER TABLE payments ADD COLUMN status VARCHAR DEFAULT 'pending'")
                )
            if "timestamp" not in payment_columns:
                connection.execute(
                    text("ALTER TABLE payments ADD COLUMN timestamp DATETIME")
                )
                connection.execute(
                    text("UPDATE payments SET timestamp = CURRENT_TIMESTAMP WHERE timestamp IS NULL")
                )


def seed_default_products():
    from .models import Product

    default_products = [
        {
            "name": "iPhone 15",
            "description": "Latest Apple smartphone",
            "price": 79999,
            "stock": 10,
            "category": "Mobiles",
            "image": "https://via.placeholder.com/200?text=iPhone+15",
            "images": "https://via.placeholder.com/200?text=iPhone+15",
            "popularity": 95,
        },
        {
            "name": "Samsung Galaxy S24",
            "description": "Flagship Samsung phone",
            "price": 74999,
            "stock": 15,
            "category": "Mobiles",
            "image": "https://via.placeholder.com/200?text=Galaxy+S24",
            "images": "https://via.placeholder.com/200?text=Galaxy+S24",
            "popularity": 90,
        },
        {
            "name": "HP Laptop",
            "description": "Powerful laptop for work and study",
            "price": 55999,
            "stock": 8,
            "category": "Laptops",
            "image": "https://via.placeholder.com/200?text=HP+Laptop",
            "images": "https://via.placeholder.com/200?text=HP+Laptop",
            "popularity": 70,
        },
        {
            "name": "Boat Headphones",
            "description": "Wireless headphones with deep bass",
            "price": 2999,
            "stock": 25,
            "category": "Accessories",
            "image": "https://via.placeholder.com/200?text=Boat+Headphones",
            "images": "https://via.placeholder.com/200?text=Boat+Headphones",
            "popularity": 82,
        },
        {
            "name": "Dell Inspiron 15",
            "description": "Everyday laptop with solid battery life and performance.",
            "price": 62999,
            "stock": 12,
            "category": "Laptops",
            "image": "https://via.placeholder.com/200?text=Dell+Inspiron",
            "images": "https://via.placeholder.com/200?text=Dell+Inspiron",
            "popularity": 76,
        },
        {
            "name": "Apple Watch SE",
            "description": "Smartwatch for fitness tracking and notifications.",
            "price": 24999,
            "stock": 14,
            "category": "Wearables",
            "image": "https://via.placeholder.com/200?text=Apple+Watch+SE",
            "images": "https://via.placeholder.com/200?text=Apple+Watch+SE",
            "popularity": 88,
        },
        {
            "name": "Realme Buds Air",
            "description": "Compact wireless earbuds with low-latency audio.",
            "price": 3499,
            "stock": 30,
            "category": "Accessories",
            "image": "https://via.placeholder.com/200?text=Realme+Buds+Air",
            "images": "https://via.placeholder.com/200?text=Realme+Buds+Air",
            "popularity": 74,
        },
        {
            "name": "Sony WH-1000XM5",
            "description": "Premium noise-cancelling headphones for immersive sound.",
            "price": 29999,
            "stock": 0,
            "category": "Accessories",
            "image": "https://via.placeholder.com/200?text=Sony+XM5",
            "images": "https://via.placeholder.com/200?text=Sony+XM5",
            "popularity": 93,
        },
        {
            "name": "iPad Air",
            "description": "Lightweight tablet for study, work, and entertainment.",
            "price": 54999,
            "stock": 0,
            "category": "Tablets",
            "image": "https://via.placeholder.com/200?text=iPad+Air",
            "images": "https://via.placeholder.com/200?text=iPad+Air",
            "popularity": 86,
        },
        {
            "name": "Logitech MX Master 3S",
            "description": "Advanced wireless mouse for productivity and design work.",
            "price": 8999,
            "stock": 18,
            "category": "Accessories",
            "image": "https://via.placeholder.com/200?text=MX+Master+3S",
            "images": "https://via.placeholder.com/200?text=MX+Master+3S",
            "popularity": 79,
        },
        {
            "name": "OnePlus 12",
            "description": "High-performance Android phone with fast charging and a flagship display.",
            "price": 64999,
            "stock": 11,
            "category": "Mobiles",
            "image": "https://via.placeholder.com/200?text=OnePlus+12",
            "images": "https://via.placeholder.com/200?text=OnePlus+12",
            "popularity": 89,
        },
        {
            "name": "Asus ROG Laptop",
            "description": "Gaming laptop with powerful graphics and smooth high-refresh performance.",
            "price": 119999,
            "stock": 0,
            "category": "Laptops",
            "image": "https://via.placeholder.com/200?text=Asus+ROG",
            "images": "https://via.placeholder.com/200?text=Asus+ROG",
            "popularity": 91,
        },
        {
            "name": "Noise ColorFit Pro",
            "description": "Affordable smartwatch with health tracking and stylish everyday design.",
            "price": 4999,
            "stock": 20,
            "category": "Wearables",
            "image": "https://via.placeholder.com/200?text=ColorFit+Pro",
            "images": "https://via.placeholder.com/200?text=ColorFit+Pro",
            "popularity": 68,
        },
        {
            "name": "Amazon Echo Dot",
            "description": "Smart speaker with voice assistant features for your home.",
            "price": 4499,
            "stock": 16,
            "category": "Smart Home",
            "image": "https://via.placeholder.com/200?text=Echo+Dot",
            "images": "https://via.placeholder.com/200?text=Echo+Dot",
            "popularity": 72,
        },
        {
            "name": "Canon EOS M50",
            "description": "Mirrorless camera suited for creators, travel shots, and video content.",
            "price": 58999,
            "stock": 0,
            "category": "Cameras",
            "image": "https://via.placeholder.com/200?text=Canon+EOS+M50",
            "images": "https://via.placeholder.com/200?text=Canon+EOS+M50",
            "popularity": 84,
        },
        {
            "name": "Samsung 27 Inch Monitor",
            "description": "Crisp full HD monitor for work, entertainment, and multitasking.",
            "price": 15999,
            "stock": 13,
            "category": "Monitors",
            "image": "https://via.placeholder.com/200?text=Samsung+Monitor",
            "images": "https://via.placeholder.com/200?text=Samsung+Monitor",
            "popularity": 77,
        },
    ]

    db = SessionLocal()
    try:
        for item in default_products:
            existing = db.query(Product).filter(Product.name == item["name"]).first()
            if existing:
                existing.description = item["description"]
                existing.price = item["price"]
                existing.stock = item["stock"]
                existing.category = item["category"]
                existing.image = item["image"]
                existing.images = item["images"]
                existing.popularity = item["popularity"]
                continue
            db.add(Product(**item))
        db.commit()
    finally:
        db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
