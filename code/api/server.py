from flask import Flask, request, jsonify
from flask_cors import CORS  # 1. Importe a biblioteca

app = Flask(__name__)

# Aplica o CORS à aplicação. Isso permite requisições de qualquer origem.
CORS(app) 

@app.route("/")
def home():
    return "API Dummy rodando 🚀"

@app.route("/predict", methods=["POST"])
def predict():
    data = request.json

    # Se não vier nada, responde com erro
    if not data or "image" not in data:
        return jsonify({"error": "Nenhuma imagem recebida"}), 400

    # Aqui você poderia rodar um modelo, mas vamos só simular
    return jsonify({
        "message": "Recebi a imagem!",
        "adultization_detected": True  # resultado fictício
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
