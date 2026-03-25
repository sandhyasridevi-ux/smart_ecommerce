from django.db import models


class User(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=255)
    role = models.CharField(max_length=50, default="customer")

    class Meta:
        db_table = "users"
        managed = False

    def __str__(self):
        return f"{self.name} ({self.email})"


class Product(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    price = models.FloatField()
    stock = models.IntegerField(default=0)
    category = models.CharField(max_length=255, blank=True, null=True)
    image = models.URLField(blank=True, null=True)
    popularity = models.IntegerField(default=0)

    class Meta:
        db_table = "products"
        managed = False

    def __str__(self):
        return self.name


class CartItem(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.DO_NOTHING, related_name="cart_items")
    product = models.ForeignKey(Product, on_delete=models.DO_NOTHING, related_name="cart_items")
    quantity = models.IntegerField(default=1)

    class Meta:
        db_table = "cart"
        managed = False

    def __str__(self):
        return f"{self.user.email} - {self.product.name} x {self.quantity}"


class Order(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.DO_NOTHING, related_name="orders")
    total = models.FloatField(default=0)
    payment_status = models.CharField(max_length=50, default="pending")
    order_status = models.CharField(max_length=50, default="pending")
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "orders"
        managed = False

    def __str__(self):
        return f"Order #{self.id} - {self.user.email}"


class OrderItem(models.Model):
    id = models.AutoField(primary_key=True)
    order = models.ForeignKey(Order, on_delete=models.DO_NOTHING, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.DO_NOTHING, related_name="order_items")
    quantity = models.IntegerField(default=1)
    price = models.FloatField(default=0)

    class Meta:
        db_table = "order_items"
        managed = False

    def __str__(self):
        return f"Order #{self.order_id} - {self.product.name} x {self.quantity}"


class Payment(models.Model):
    id = models.AutoField(primary_key=True)
    order = models.ForeignKey(Order, on_delete=models.DO_NOTHING, related_name="payments")
    amount = models.FloatField(default=0)
    payment_method = models.CharField(max_length=50, default="card")
    transaction_id = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=50, default="pending")
    timestamp = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "payments"
        managed = False

    def __str__(self):
        return f"Payment #{self.id} - Order #{self.order_id}"
