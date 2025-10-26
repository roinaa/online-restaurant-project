from rest_framework import serializers
from .models import DishCategory, Dish

class DishCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = DishCategory
        fields = ['id', 'name', 'slug']

class DishSerializer(serializers.ModelSerializer):
    category = serializers.StringRelatedField()
    spiciness_display = serializers.CharField(source='get_spiciness_display', read_only=True)

    class Meta:
        model = Dish
        fields = ['id', 'category', 'name', 'image', 'price',
                  'spiciness', 'spiciness_display', 'has_nuts', 'is_vegetarian', 'description']