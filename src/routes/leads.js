import express from "express";
import {
  isInsightlyConfigured,
  listRecentLeads,
  getLeadById,
  deleteLead,
  parseLeadDescription,
} from "../lib/insightly.js";
import { query } from "../lib/db.js";

const router = express.Router();

// --- Daftar leads (halaman utama) ---
router.get("/", async (req, res, next) => {
  try {
    if (!isInsightlyConfigured()) {
      return res.render("leads-list", {
        error: "INSIGHTLY_API_KEY/INSIGHTLY_POD belum diisi di .env -- tidak bisa ambil data Leads.",
        leads: [],
        q: "",
      });
    }
    const leads = await listRecentLeads({ limit: 300, forceRefresh: req.query.refresh === "1" });
    const q = (req.query.q || "").trim().toLowerCase();
    const filtered = q
      ? leads.filter((l) => {
          const haystack = `${l.FIRST_NAME || ""} ${l.LAST_NAME || ""} ${l.EMAIL || ""} ${l.PHONE || ""} ${l.LEAD_DESCRIPTION || ""}`.toLowerCase();
          return haystack.includes(q);
        })
      : leads;

    res.render("leads-list", {
      error: null,
      leads: filtered.map((l) => ({
        ...l,
        _visa: parseLeadDescription(l.LEAD_DESCRIPTION).visaCategory,
      })),
      q: req.query.q || "",
    });
  } catch (err) {
    next(err);
  }
});

// --- Detail 1 lead: info Insightly + Meeting Summary + LOA ---
router.get("/leads/:id", async (req, res, next) => {
  try {
    const leadId = req.params.id;
    const lead = await getLeadById(leadId);
    if (!lead) {
      return res.status(404).render("error", { message: `Lead #${leadId} tidak ditemukan di Insightly (mungkin sudah dihapus/di-convert).` });
    }
    const { visaCategory, summaryBody } = parseLeadDescription(lead.LEAD_DESCRIPTION);

    let meetingSummaries = [];
    let loaDocuments = [];
    let dbError = null;
    try {
      const [ms, loa] = await Promise.all([
        query("SELECT * FROM meeting_summaries WHERE insightly_lead_id = $1 ORDER BY meeting_date DESC NULLS LAST, created_at DESC", [leadId]),
        query("SELECT * FROM loa_documents WHERE insightly_lead_id = $1 ORDER BY created_at DESC", [leadId]),
      ]);
      meetingSummaries = ms.rows;
      loaDocuments = loa.rows;
    } catch (e) {
      dbError = "Database belum siap (DATABASE_URL belum diisi atau migrasi belum dijalankan) -- Meeting Summary & LOA belum bisa ditampilkan/disimpan.";
    }

    res.render("lead-detail", {
      lead,
      visaCategory,
      summaryBody,
      meetingSummaries,
      loaDocuments,
      dbError,
      saved: req.query.saved || null,
    });
  } catch (err) {
    next(err);
  }
});

// --- Tambah Meeting Summary (input manual konsultan) ---
router.post("/leads/:id/meeting-summary", async (req, res, next) => {
  try {
    const leadId = req.params.id;
    const { meeting_date, consultant_name, summary, lead_name, lead_email } = req.body;
    if (!summary || !summary.trim()) {
      return res.redirect(`/leads/${leadId}?saved=error-empty`);
    }
    await query(
      `INSERT INTO meeting_summaries (insightly_lead_id, lead_name, lead_email, meeting_date, consultant_name, summary)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [leadId, lead_name || null, lead_email || null, meeting_date || null, consultant_name || null, summary.trim()]
    );
    res.redirect(`/leads/${leadId}?saved=meeting`);
  } catch (err) {
    next(err);
  }
});

// --- Hapus Meeting Summary ---
router.post("/leads/:id/meeting-summary/:summaryId/delete", async (req, res, next) => {
  try {
    const { id: leadId, summaryId } = req.params;
    await query("DELETE FROM meeting_summaries WHERE id = $1 AND insightly_lead_id = $2", [summaryId, leadId]);
    res.redirect(`/leads/${leadId}?saved=deleted`);
  } catch (err) {
    next(err);
  }
});

// --- Tambah LOA (teks ditempel langsung, atau link ke dokumen eksternal) ---
router.post("/leads/:id/loa", async (req, res, next) => {
  try {
    const leadId = req.params.id;
    const { kind, title, content, link_url, lead_name, lead_email } = req.body;
    if (kind === "link" && (!link_url || !link_url.trim())) {
      return res.redirect(`/leads/${leadId}?saved=error-empty`);
    }
    if (kind === "text" && (!content || !content.trim())) {
      return res.redirect(`/leads/${leadId}?saved=error-empty`);
    }
    await query(
      `INSERT INTO loa_documents (insightly_lead_id, lead_name, lead_email, kind, content, link_url, title)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        leadId,
        lead_name || null,
        lead_email || null,
        kind === "link" ? "link" : "text",
        kind === "text" ? content.trim() : null,
        kind === "link" ? link_url.trim() : null,
        title || null,
      ]
    );
    res.redirect(`/leads/${leadId}?saved=loa`);
  } catch (err) {
    next(err);
  }
});

// --- Hapus LOA ---
router.post("/leads/:id/loa/:loaId/delete", async (req, res, next) => {
  try {
    const { id: leadId, loaId } = req.params;
    await query("DELETE FROM loa_documents WHERE id = $1 AND insightly_lead_id = $2", [loaId, leadId]);
    res.redirect(`/leads/${leadId}?saved=deleted`);
  } catch (err) {
    next(err);
  }
});

// --- Hapus Lead dari Insightly (dipakai untuk bersih-bersih Lead test) ---
router.post("/leads/:id/delete-from-insightly", async (req, res, next) => {
  try {
    await deleteLead(req.params.id);
    res.redirect("/?refresh=1");
  } catch (err) {
    next(err);
  }
});

export default router;
