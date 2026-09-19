package util

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/gofiber/fiber/v2"
)

// SHA256Hex returns the lowercase hex SHA-256 digest of s.
func SHA256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return fmt.Sprintf("%x", h)
}

// DeriveKey returns a 32-byte key derived from a secret byte slice.
func DeriveKey(secret []byte) []byte {
	h := sha256.Sum256(secret)
	return h[:]
}

// EncryptAESGCM encrypts plaintext using AES-GCM with a 32-byte key.
// Returns a standard base64 encoded string containing nonce + ciphertext + tag.
func EncryptAESGCM(plaintext []byte, key []byte) (string, error) {
	block, err := aes.NewCipher(DeriveKey(key))
	if err != nil {
		return "", err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, aesGCM.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := aesGCM.Seal(nonce, nonce, plaintext, nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptAESGCM decrypts a base64 encoded nonce+ciphertext+tag using AES-GCM.
func DecryptAESGCM(encoded string, key []byte) ([]byte, error) {
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(DeriveKey(key))
	if err != nil {
		return nil, err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := aesGCM.NonceSize()
	if len(data) < nonceSize {
		return nil, errors.New("ciphertext too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	return aesGCM.Open(nil, nonce, ciphertext, nil)
}

// MaskString masks middle characters of a sensitive string for safe display.
func MaskString(s string) string {
	if len(s) == 0 {
		return ""
	}
	if len(s) <= 8 {
		return "••••••••"
	}
	return s[:4] + "••••••••" + s[len(s)-4:]
}

// NowMs returns the current UTC time as Unix milliseconds.
func NowMs() int64 {
	return time.Now().UnixMilli()
}

// WriteJSON sends v as a JSON body with the given status code.
func WriteJSON(c *fiber.Ctx, status int, v any) error {
	c.Status(status)
	c.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSONCharsetUTF8)
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return c.Send(b)
}
