
serve:
	echo "Open http://localhost:8080/test/ in your browser"
	python3 -m http.server 8080

gen-cert:
	rm -f cert.pem key.pem
	openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 10000 -nodes \
		-subj "/C=/ST=/L=/O=/CN="

run:
	PYTHONPATH=src python3 test/test.py cert.pem key.pem 13

pre-deploy:
	python3 -m pip install --upgrade build
	python3 -m pip install --upgrade twine

deploy:
	python3 -m build

test-upload:
	python3 -m twine upload --repository testpypi dist/*

run-test-upload:
	python3 -m pip install --index-url https://test.pypi.org/simple/ canal-mqtt --upgrade
	python3 test/test.py cert.pem key.pem 13

production-upload:
	python3 -m twine upload dist/*

run-production-upload:
	python3 -m pip install canal-mqtt --upgrade
	python3 test/test.py cert.pem key.pem 13