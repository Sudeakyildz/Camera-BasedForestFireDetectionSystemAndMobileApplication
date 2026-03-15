"""Bilgisayarda CUDA (GPU) var mi kontrol eder."""
import torch

if torch.cuda.is_available():
    print("CUDA var. GPU:", torch.cuda.get_device_name(0))
    print("CUDA versiyon:", torch.version.cuda)
else:
    print("CUDA yok - CPU kullaniliyor.")
