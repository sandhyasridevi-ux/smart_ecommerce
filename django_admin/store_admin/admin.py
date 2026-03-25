from django.contrib import admin

from .models import CartItem, Order, OrderItem, Payment, Product, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "email", "role")
    search_fields = ("name", "email", "role")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "category", "price", "stock", "popularity")
    list_filter = ("category",)
    search_fields = ("name", "category")


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "product", "quantity")
    search_fields = ("user__email", "product__name")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "total", "payment_status", "order_status", "created_at")
    list_filter = ("payment_status", "order_status")
    search_fields = ("user__email",)


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "product", "quantity", "price")
    search_fields = ("order__id", "product__name")


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "amount", "payment_method", "status", "transaction_id", "timestamp")
    list_filter = ("payment_method", "status")
    search_fields = ("order__id", "transaction_id")
