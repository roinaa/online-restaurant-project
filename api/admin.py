from django.contrib import admin
from .models import DishCategory, Dish

@admin.register(DishCategory)
class DishCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}

@admin.register(Dish)
class DishAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'spiciness', 'has_nuts', 'is_vegetarian')
    list_filter = ('category', 'spiciness', 'has_nuts', 'is_vegetarian')
    search_fields = ('name', 'description')