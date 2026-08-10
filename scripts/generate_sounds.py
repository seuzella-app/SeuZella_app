import os

def create_valid_mp3(filepath, duration_sec=0.5):
    # MPEG 1.0 Layer III 128 kbps 44.1 kHz Mono/Joint Stereo frame
    header = b'\xff\xfb\x90\x64'
    frame_size = 417
    data_bytes = b'\x55\xaa' * ((frame_size - 4) // 2)
    frame = header + data_bytes
    num_frames = max(4, int(duration_sec / 0.026122))
    
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'wb') as f:
        f.write(frame * num_frames)
    print(f"Created sound file {filepath} ({os.path.getsize(filepath)} bytes)")

sounds = [
    'public/sounds/cash-register.mp3',
    'public/sounds/whatsapp-notification.mp3',
    'public/sounds/booking-confirmed.mp3',
    'public/sounds/message.mp3',
    'public/sounds/new-booking.mp3',
    'public/sounds/error.mp3',
    'public/sounds/alert.mp3',
    'public/sounds/notification.mp3',
    'public/sounds/success.mp3',
    'public/sounds/info.mp3'
]

for s in sounds:
    create_valid_mp3(s, 0.4)
