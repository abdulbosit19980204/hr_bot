from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    TestViewSet, QuestionViewSet, UserViewSet,
    CVViewSet, TestResultViewSet, StatisticsView
)

router = DefaultRouter()
router.register(r'tests', TestViewSet, basename='test')
router.register(r'questions', QuestionViewSet, basename='question')
router.register(r'users', UserViewSet, basename='user')
router.register(r'cvs', CVViewSet, basename='cv')
router.register(r'results', TestResultViewSet, basename='result')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('statistics/', StatisticsView.as_view(), name='statistics'),
]

