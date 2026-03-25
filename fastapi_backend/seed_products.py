from .database import SessionLocal, engine, Base
from .models import Product

Base.metadata.create_all(bind=engine)

db = SessionLocal()

products = [
    {
        "name": "iPhone 15",
        "description": "Latest Apple smartphone",
        "price": 79999,
        "stock": 10,
        "category": "Mobiles",
        "image": "https://via.placeholder.com/200",
        "popularity": 95,
    },
    {
        "name": "Samsung Galaxy S24",
        "description": "Flagship Samsung phone",
        "price": 74999,
        "stock": 15,
        "category": "Mobiles",
        "image": "https://via.placeholder.com/200",
        "popularity": 90,
    },
    {
        "name": "HP Laptop",
        "description": "Powerful laptop for work and study",
        "price": 55999,
        "stock": 8,
        "category": "Laptops",
        "image": "https://via.placeholder.com/200",
        "popularity": 70,
    },
    {
        "name": "Boat Headphones",
        "description": "Wireless headphones with deep bass",
        "price": 2999,
        "stock": 25,
        "category": "Accessories",
        "image": "https://via.placeholder.com/200",
        "popularity": 82,
    }
]

for item in products:
    existing = db.query(Product).filter(Product.name == item["name"]).first()
    if not existing:
        db.add(Product(**item))

db.commit()
db.close()

print("Products seeded successfully!")
