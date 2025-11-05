from django.contrib import admin
# დავაიმპორტოთ ყველა ჩვენი მოდელი
from .models import DishCategory, Dish, UserProfile, Order, OrderItem, Review, Coupon

@admin.register(DishCategory)
class DishCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}

@admin.register(Dish)
class DishAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'spiciness', 'is_featured', 'has_nuts', 'is_vegetarian')
    list_filter = ('category', 'spiciness', 'is_featured', 'has_nuts', 'is_vegetarian')
    search_fields = ('name', 'description')

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'phone_number', 'city')
    search_fields = ('user__username', 'phone_number')

# ეს კლასი საშუალებას გვაძლევს, შეკვეთის დეტალები პირდაპირ Order-ის გვერდზე ვნახოთ და დავამატოთ
class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('price_at_order',) #

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'status', 'created_at', 'total_price')
    list_filter = ('status', 'created_at')
    search_fields = ('user__username', 'id')
    inlines = [OrderItemInline]

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('dish', 'user', 'rating', 'created_at')
    list_filter = ('rating', 'created_at')
    search_fields = ('user__username', 'dish__name', 'comment')

@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ('code', 'discount_percent', 'is_active', 'valid_to', 'one_use_per_user')
    list_filter = ('is_active', 'one_use_per_user')
    search_fields = ('code',)