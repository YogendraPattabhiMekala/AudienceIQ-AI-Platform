FROM python:3.12-slim
WORKDIR /srv
COPY backend/requirements.txt /srv/requirements.txt
RUN pip install --no-cache-dir -r /srv/requirements.txt
COPY backend /srv/backend
COPY data /srv/data
WORKDIR /srv/backend
ENV PYTHONPATH=/srv/backend
EXPOSE 8080
CMD ["python", "-m", "app.main"]
