#include <napi.h>
#include <cstring>

// XOR key for obfuscation
static const uint8_t XOR_KEY[] = {0x4E, 0x53, 0x41, 0x47, 0x45, 0x00, 0x4E, 0x69,
                                   0x6E, 0x6A, 0x61, 0x53, 0x61, 0x67, 0x65, 0x2D,
                                   0x76, 0x31, 0x2D, 0x32, 0x30, 0x32, 0x36, 0x00,
                                   0x50, 0x75, 0x62, 0x6C, 0x69, 0x63, 0x4B, 0x65};
static const int XOR_KEY_LEN = 32;

// Obfuscated public key bytes (Ed25519 32-byte public key, XOR encoded)
static const uint8_t ENC_PUBLIC_KEY[] = {
    0xe0, 0x81, 0x63, 0x11, 0xda, 0x99, 0xf6, 0x96,
    0xeb, 0x3c, 0x92, 0x61, 0xc8, 0xb8, 0x07, 0xa9,
    0xab, 0xc1, 0x27, 0x40, 0x31, 0x5e, 0x8d, 0xb2,
    0x5d, 0xea, 0x2c, 0x7d, 0x0c, 0x89, 0x2c, 0x22
};
static const int PUBLIC_KEY_LEN = 32;

// Decoded key cache
static uint8_t decoded_key[PUBLIC_KEY_LEN];
static bool key_decoded = false;

static void decode_key() {
    if (key_decoded) return;
    for (int i = 0; i < PUBLIC_KEY_LEN; i++) {
        decoded_key[i] = ENC_PUBLIC_KEY[i] ^ XOR_KEY[i % XOR_KEY_LEN];
    }
    key_decoded = true;
}

// Get the public key as a Buffer
Napi::Value GetPublicKey(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    decode_key();
    return Napi::Buffer<uint8_t>::Copy(env, decoded_key, PUBLIC_KEY_LEN);
}

// Verify that a given 32-byte array matches the stored public key
Napi::Value VerifyPublicKey(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsBuffer()) {
        Napi::TypeError::New(env, "Expected a Buffer argument").ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }
    Napi::Buffer<uint8_t> buf = info[0].As<Napi::Buffer<uint8_t>>();
    if (buf.Length() != PUBLIC_KEY_LEN) {
        return Napi::Boolean::New(env, false);
    }
    decode_key();
    const uint8_t* data = buf.Data();
    for (int i = 0; i < PUBLIC_KEY_LEN; i++) {
        if (data[i] != decoded_key[i]) return Napi::Boolean::New(env, false);
    }
    return Napi::Boolean::New(env, true);
}

// Get key length
Napi::Value GetKeyLength(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), PUBLIC_KEY_LEN);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("getPublicKey", Napi::Function::New(env, GetPublicKey));
    exports.Set("verifyPublicKey", Napi::Function::New(env, VerifyPublicKey));
    exports.Set("getKeyLength", Napi::Function::New(env, GetKeyLength));
    return exports;
}

NODE_API_MODULE(license_key, Init)
