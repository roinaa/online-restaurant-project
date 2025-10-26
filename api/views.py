from rest_framework import generics
from .models import DishCategory, Dish
from .serializers import DishCategorySerializer, DishSerializer
from rest_framework import filters

class DishCategoryListAPIView(generics.ListAPIView):
    queryset = DishCategory.objects.all()
    serializer_class = DishCategorySerializer

class DishListAPIView(generics.ListAPIView):
    queryset = Dish.objects.all()
    serializer_class = DishSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['name', 'price']

    def get_queryset(self):
        queryset = super().get_queryset()

        category_slug = self.request.query_params.get('category')
        if category_slug:
            queryset = queryset.filter(category__slug=category_slug)

        spiciness = self.request.query_params.get('spiciness')
        if spiciness is not None and spiciness.isdigit():
            queryset = queryset.filter(spiciness=spiciness)

        has_nuts = self.request.query_params.get('has_nuts')
        if has_nuts is not None:
            has_nuts_bool = has_nuts.lower() in ('true', '1')
            queryset = queryset.filter(has_nuts=has_nuts_bool)

        is_vegetarian = self.request.query_params.get('is_vegetarian')
        if is_vegetarian is not None:
            is_vegetarian_bool = is_vegetarian.lower() in ('true', '1')
            queryset = queryset.filter(is_vegetarian=is_vegetarian_bool)

        return queryset