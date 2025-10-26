from django.urls import path
from .views import DishCategoryListAPIView, DishListAPIView

urlpatterns = [
    path('categories/', DishCategoryListAPIView.as_view(), name='category-list'),
    path('dishes/', DishListAPIView.as_view(), name='dish-list'),
]