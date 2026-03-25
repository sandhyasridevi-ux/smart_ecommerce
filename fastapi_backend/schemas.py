from typing import Optional, List
from pydantic import BaseModel, EmailStr, ConfigDict, Field, model_validator


# -------------------------
# Auth Schemas
# -------------------------

class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    role: str = "customer"


class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[EmailStr] = None
    password: str = Field(..., min_length=6, max_length=100)

    @model_validator(mode="after")
    def validate_identifier(self):
        if not self.email and not self.username:
            raise ValueError("Either email or username is required")
        return self


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: dict


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class SocialLoginRequest(BaseModel):
    provider: str = Field(..., pattern="^(auth0|google|facebook)$")
    access_token: str


class UserMeResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    is_active: bool = True
    created_at: Optional[str] = None


# -------------------------
# Product Schemas
# -------------------------
class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    price: float
    stock: int = 0
    image: Optional[str] = None
    images: Optional[str] = None
    popularity: int = 0


class ProductCreate(ProductBase):
    pass


class ProductUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = Field(default=None, ge=0)
    stock: Optional[int] = Field(default=None, ge=0)
    image: Optional[str] = None
    images: Optional[str] = None
    popularity: Optional[int] = Field(default=None, ge=0)


class ProductResponse(ProductBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class ProductStockUpdateRequest(BaseModel):
    stock: int = Field(..., ge=0)


# -------------------------
# Cart Schemas
# -------------------------
class CartAddRequest(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)


class CartUpdateRequest(BaseModel):
    product_id: int
    quantity: int = Field(..., ge=0)


class CartRemoveRequest(BaseModel):
    product_id: int


class CartItemProduct(BaseModel):
    id: int
    name: str
    category: Optional[str] = None
    price: float
    stock: int
    image: Optional[str] = None
    images: Optional[str] = None
    popularity: int = 0

    model_config = ConfigDict(from_attributes=True)


class CartItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    item_total: float
    product: CartItemProduct

    model_config = ConfigDict(from_attributes=True)


class CartSummaryResponse(BaseModel):
    items: List[CartItemResponse]
    cart_total: float
    tax: float
    grand_total: float


class CheckoutRequest(BaseModel):
    payment_method: str = Field(default="card", pattern="^(card|upi|wallet|cod)$")
    currency: str = Field(default="inr", min_length=3, max_length=10)
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class PaymentResponse(BaseModel):
    id: int
    order_id: int
    amount: float
    payment_method: str
    transaction_id: Optional[str] = None
    status: str
    timestamp: str

    model_config = ConfigDict(from_attributes=True)


class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    price: float
    product: CartItemProduct

    model_config = ConfigDict(from_attributes=True)


class OrderResponse(BaseModel):
    id: int
    user_id: int
    total: float
    payment_status: str
    order_status: str
    created_at: str
    items: List[OrderItemResponse]


class StripeCheckoutResponse(BaseModel):
    payment_intent_id: Optional[str] = None
    checkout_session_id: Optional[str] = None
    checkout_session_url: Optional[str] = None
    publishable_key: Optional[str] = None
    configured: bool
    message: str


class CheckoutResponse(BaseModel):
    order: OrderResponse
    payment: PaymentResponse
    amount: float
    currency: str
    stripe: StripeCheckoutResponse


class OrderStatusUpdateRequest(BaseModel):
    order_status: str = Field(
        ...,
        pattern="^(pending|paid|shipped|delivered|cancelled)$",
    )


class NotificationCreateRequest(BaseModel):
    user_id: Optional[int] = None
    title: str = Field(..., min_length=2, max_length=120)
    message: str = Field(..., min_length=2, max_length=1000)
    type: str = Field(..., pattern="^(order|payment|shipping|stock|system|admin_alert)$")


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    type: str
    is_read: bool
    read_status: Optional[bool] = None
    timestamp: Optional[str] = None
    created_at: str

    model_config = ConfigDict(from_attributes=True)


class PaymentStatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(pending|completed|failed)$")


class NotificationReadRequest(BaseModel):
    notification_id: Optional[int] = None
    is_read: bool = True
    mark_all: bool = False


class AdminUserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    is_active: bool
    created_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AdminUserUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    role: Optional[str] = Field(default=None, pattern="^(admin|staff|customer)$")
    is_active: Optional[bool] = None
