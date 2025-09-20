# ai_matcher.py
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

class TextMatcher:
    def _init_(self):
        self.vectorizer = TfidfVectorizer(stop_words='english')
        self.tf_idf_matrix = None
        self.item_texts = []

    def fit(self, item_texts):
        """
        item_texts: list of strings (one per item).
        """
        if not item_texts:
            self.tf_idf_matrix = None
            self.item_texts = []
            return
        self.item_texts = item_texts
        self.tf_idf_matrix = self.vectorizer.fit_transform(item_texts)

    def query(self, query_text, top_k=5):
        """
        Return list of (index, score) sorted by score desc.
        Index corresponds to the position in the item_texts list.
        """
        if self.tf_idf_matrix is None:
            return []
        q_vec = self.vectorizer.transform([query_text])
        sims = cosine_similarity(q_vec, self.tf_idf_matrix).flatten()
        idxs = np.argsort(-sims)[:top_k]
        return [(int(i), float(sims[i])) for i in idxs if sims[i] > 0.0]
