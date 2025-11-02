from django.urls import path
from .views import (
    DishCategoryListAPIView,
    DishListAPIView,
    RegisterView,
    LoginView,
    LogoutView,
    CartView,
    PlaceOrderView,
    OrderHistoryView,
    FeaturedDishListView,
    UserProfileView,
    ChangePasswordView,
)

urlpatterns = [
    path('categories/', DishCategoryListAPIView.as_view(), name='category-list'),
    path('dishes/', DishListAPIView.as_view(), name='dish-list'),
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('cart/', CartView.as_view(), name='cart-api'),
    path('orders/place/', PlaceOrderView.as_view(), name='place-order'),
    path('orders/history/', OrderHistoryView.as_view(), name='order-history'),
    path('featured-dishes/', FeaturedDishListView.as_view(), name='featured-dishes'),
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('profile/change-password/', ChangePasswordView.as_view(), name='change-password'),
]