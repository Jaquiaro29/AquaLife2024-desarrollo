# app.py
import warnings
import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify
from flask_cors import CORS  # <--- Importamos
from requests.packages.urllib3.exceptions import InsecureRequestWarning

app = Flask(__name__)
# Habilita CORS en todas las rutas. Alternativamente: CORS(app, resources={r"/api/*": {"origins": "*"}})
CORS(app)

@app.route('/api/tasa', methods=['GET'])
def get_bcv_rate():
    try:
        warnings.simplefilter("ignore", InsecureRequestWarning)
        url = "https://www.bcv.org.ve/"
        response = requests.get(url, verify=False, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        # Ajusta el selector según el HTML real
        dollar_element = soup.select_one("div.col-sm-6.col-xs-6.centrado strong")
        if not dollar_element:
            return jsonify({"error": "No se pudo encontrar la tasa en el HTML"}), 500

        raw_value = dollar_element.get_text(strip=True)
        raw_value = raw_value.replace(",", ".")
        tasa = float(raw_value)

        return jsonify({"tasa": tasa})

    except Exception as e:
        print("Error al obtener la tasa:", e)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
