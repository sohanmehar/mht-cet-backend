const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// 1. Unique Dynamic Districts Extraction
router.get('/districts', async (req, res) => {
    try {
        const database = mongoose.connection.db;
        let distinctDistricts = await database.collection('colleges').distinct('city');
        
        if (!distinctDistricts || distinctDistricts.length === 0) {
            distinctDistricts = await database.collection('colleges').distinct('district');
        }

        const sortedDistricts = distinctDistricts
            .filter(Boolean)
            .map(d => String(d).trim())
            .sort((a, b) => a.localeCompare(b));

        return res.status(200).json({ success: true, data: sortedDistricts });
    } catch (error) {
        console.error("Fetch Districts Failure:", error);
        return res.status(500).json({ success: false, message: "Database stream unreachable" });
    }
});

// 2. Unique Dynamic Branches Extraction
router.get('/branches', async (req, res) => {
    try {
        const database = mongoose.connection.db;
        const distinctBranches = await database.collection('branches').distinct('branchName');
        const sortedBranches = distinctBranches.filter(Boolean).map(b => String(b).trim()).sort((a, b) => a.localeCompare(b));
        return res.status(200).json({ success: true, data: sortedBranches });
    } catch (error) {
        console.error("Fetch Branches Error:", error);
        return res.status(500).json({ success: false, message: "Failed to load branches" });
    }
});

// 📌 Helper function to dynamically expand categories matching CAP patterns
const getCategoryRegexPattern = (baseCategory) => {
    const cleanCat = baseCategory.toUpperCase().trim();
    // Agar input directly details handle kar raha hai, fallback to matching roots
    if (cleanCat === "OPEN" || cleanCat === "GOPENS" || cleanCat === "LOPENS") {
        return new RegExp(".*OPEN.*|.*AI.*", "i");
    }
    // Catches GOBCS, LOBCS, PWDOBC, DEFOBC, etc.
    return new RegExp(`.*${cleanCat}.*`, "i");
};

// 3. Core Aggregation Predictor Engine
router.post('/predict', async (req, res) => {
    try {
        const { percentile, category, branch, city } = req.body;

        if (!percentile || !category) {
            return res.status(400).json({ success: false, message: "Percentile and Category are required!" });
        }

        const userPercentile = parseFloat(percentile);
        const database = mongoose.connection.db;

        const cityFilter = city && Array.isArray(city) ? city.filter(c => c !== "ALL" && c.trim() !== "") : [];
        const branchFilter = branch && Array.isArray(branch) ? branch.filter(b => b !== "ALL" && b.trim() !== "") : [];

        // 🔥 FIX 1: DYNAMIC REGEX CATEGORY PATTERN EXPANSION LOCK
        const categoryRegex = getCategoryRegexPattern(category);

        const cleanCityInputs = cityFilter.map(c => c.replace(/[^a-zA-Z\s]/g, "").trim().toLowerCase());

        // Build base query utilizing numbers indexes directly
        let initialMatch = { category: { $regex: categoryRegex } };
        
        if (userPercentile >= 99.0) {
            initialMatch.percentile = { $gte: 90.0 };
        }

        const pipeline = [
            { $match: initialMatch },
            {
                $addFields: {
                    numericPercentile: { $toDouble: "$percentile" },
                    strCollegeCode: { $trim: { input: { $toString: "$collegeCode" } } },
                    strBranchCode: { $trim: { input: { $toString: "$branchCode" } } }
                }
            },
            {
                $group: {
                    _id: { 
                        collegeCode: "$strCollegeCode", 
                        branchCode: "$strBranchCode" 
                    },
                    roundsData: {
                        $push: { round: "$round", percentile: "$numericPercentile", category: "$category", rank: "$rank", year: "$year" }
                    },
                    rawBranchName: { $first: "$branchName" }
                }
            },
            {
                $lookup: {
                    from: "branches",
                    let: { cCode: "$_id.collegeCode", bCode: "$_id.branchCode" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: [ { $trim: { input: { $toString: "$collegeCode" } } }, "$$cCode" ] },
                                        { $eq: [ { $trim: { input: { $toString: "$branchCode" } } }, "$$bCode" ] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "branchDetails"
                }
            },
            {
                $addFields: {
                    matchedBranch: { $arrayElemAt: ["$branchDetails", 0] }
                }
            },
            {
                $addFields: {
                    finalBranchName: { $ifNull: ["$matchedBranch.branchName", "$rawBranchName", "Engineering Stream"] }
                }
            }
        ];

        if (branchFilter.length > 0) {
            pipeline.push({
                $match: { "finalBranchName": { $in: branchFilter.map(b => new RegExp(b, "i")) } }
            });
        }

        pipeline.push(
            {
                $lookup: {
                    from: "colleges",
                    let: { cCode: "$_id.collegeCode" },
                    pipeline: [
                        { $match: { $expr: { $eq: [ { $trim: { input: { $toString: "$collegeCode" } } }, "$$cCode" ] } } }
                    ],
                    as: "collegeDetails"
                }
            },
            {
                $addFields: {
                    matchedCollege: { $arrayElemAt: ["$collegeDetails", 0] }
                }
            }
        );

        if (cleanCityInputs.length > 0) {
            pipeline.push({
                $match: {
                    $expr: {
                        $let: {
                            vars: {
                                dbCityClean: { 
                                    $trim: { 
                                        input: { $replaceAll: { input: { $toLower: "$matchedCollege.city" }, find: ".", replacement: "" } } 
                                    } 
                                }
                            },
                            in: { $in: ["$$dbCityClean", cleanCityInputs] }
                        }
                    }
                }
            });
        }

        pipeline.push({
            $project: {
                _id: 0,
                collegeCode: "$_id.collegeCode", 
                branchCode: "$_id.branchCode",
                branchName: "$finalBranchName",
                collegeName: { $ifNull: ["$matchedCollege.collegeName", "Unknown Premium Institute"] },
                city: { $ifNull: ["$matchedCollege.city", "Maharashtra"] },
                tierLabel: { $ifNull: ["$matchedCollege.tierLabel", "Elite"] },
                tierScore: { $toDouble: { $ifNull: [ "$matchedCollege.tierScore", 90 ] } },
                status: { $ifNull: ["$matchedCollege.status", "Autonomous"] },
                rounds: "$roundsData",
                cutoffPercentile: { $max: "$roundsData.percentile" }
            }
        });

        if (userPercentile < 99.0) {
            pipeline.push({ $match: { cutoffPercentile: { $lte: userPercentile + 3.0 } } });
        }

        pipeline.push(
            { $sort: { tierScore: -1, cutoffPercentile: -1 } },
            { $limit: 250 }
        );

        const results = await database.collection('cutoffs')
            .aggregate(pipeline, { allowDiskUse: true })
            .toArray();

        const structuredData = results.map(item => {
            const highestCutoff = Math.max(...(item.rounds || []).map(r => Number(r.percentile) || 0));
            const difference = highestCutoff - userPercentile;
            let recommendationType = "MATCH";
            if (difference > 1.0) {
                recommendationType = "REACH";
            } else if (difference < -1.0) {
                recommendationType = "SAFE";
            }
            const matchScore = Math.max(0, 100 - (Math.abs(difference) * 10));
            return {
                ...item,
                cutoffPercentile: highestCutoff,
                recommendationType,
                matchScore
            };
        });

        const priorityMap = { MATCH: 1, SAFE: 2, REACH: 3 };
        structuredData.sort((a, b) => {
            const pA = priorityMap[a.recommendationType] || 99;
            const pB = priorityMap[b.recommendationType] || 99;
            // Rule 1: Always sort by recommendation group first (MATCH -> SAFE -> REACH)
            if (pA !== pB) return pA - pB;
            // Rule 2: Absolute REACH/Ambitious category checks (User score is lower than cutoff)
            // For REACH, we rank items where user is closest to breaking in (Highest Match Score first)
            if (a.recommendationType === "REACH") {
                if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
                if (b.tierScore !== a.tierScore) return b.tierScore - a.tierScore;
                return b.cutoffPercentile - a.cutoffPercentile;
            }
            // Rule 3: For MATCH and SAFE options (User already has upper hand)
            // College Reputation (Tier Score) and Branch Competitiveness (Highest Cutoff) rule supreme!
            if (b.tierScore !== a.tierScore) return b.tierScore - a.tierScore;
            // If Tiers match perfectly, the branch with the HIGHER cutoff (tougher to get) goes first
            return b.cutoffPercentile - a.cutoffPercentile;
        });

        return res.status(200).json({ success: true, data: structuredData });
    } catch (error) {
        console.error("Predictor core crash:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

// 4. Dynamic Master Institutional Directory
router.get('/colleges-directory', async (req, res) => {
    try {
        const database = mongoose.connection.db;
        const colleges = await database.collection('colleges').find({}).toArray();
        const branches = await database.collection('branches').find({}).toArray();

        const branchMap = {};
        branches.forEach(b => {
            if (b.collegeCode && b.branchName) {
                const cleanCode = String(Number(b.collegeCode));
                if (!branchMap[cleanCode]) branchMap[cleanCode] = [];
                if (!branchMap[cleanCode].includes(b.branchName)) {
                    branchMap[cleanCode].push(b.branchName);
                }
            }
        });

        const formattedDirectory = colleges.map(college => {
            const rawCode = String(college.collegeCode || '').trim();
            const cleanCollegeCode = String(Number(college.collegeCode || 0));
            
            return {
                collegeCode: rawCode, 
                collegeName: college.collegeName,
                city: college.city || college.district || "Maharashtra",
                status: college.status || "Non-Autonomous",
                tierLabel: college.tierLabel || "Good",
                branches: branchMap[cleanCollegeCode] || [] 
            };
        });

        formattedDirectory.sort((a, b) => a.collegeName.localeCompare(b.collegeName));
        return res.status(200).json({ success: true, data: formattedDirectory });
    } catch (error) {
        console.error("Directory formatting error:", error);
        return res.status(500).json({ success: false, message: "Database pool disconnected" });
    }
});

// 5. Unique Dynamic Categories Extraction from Cutoffs Dataset
router.get('/categories', async (req, res) => {
    try {
        const database = mongoose.connection.db;
        
        // Fetch all distinct categories directly from the raw data dump
        const distinctCategories = await database.collection('cutoffs').distinct('category');
        
        // Clean duplicates, whitespaces and filter out null values
        const sortedCategories = distinctCategories
            .filter(Boolean)
            .map(c => String(c).trim().toUpperCase())
            .filter((value, index, self) => self.indexOf(value) === index) // Unique validation filter
            .sort((a, b) => a.localeCompare(b));

        return res.status(200).json({ success: true, data: sortedCategories });
    } catch (error) {
        console.error("Fetch Dynamic Categories Error:", error);
        return res.status(500).json({ success: false, message: "Failed to load database categories stream" });
    }
});

// 🚨 FIX 2: BULLETPROOF OPTIMIZED MOCK SIMULATOR ENDPOINT
router.post('/predict/simulate-mock', async (req, res) => {
    try {
        const { percentile, category, preferences } = req.body;
        
        if (!percentile || !category || !Array.isArray(preferences)) {
            return res.status(400).json({ success: false, message: "Required fields missing" });
        }

        const userPercentile = parseFloat(percentile);
        const database = mongoose.connection.db;
        let allottedUnit = null;

        const categoryRegex = getCategoryRegexPattern(category);

        for (let i = 0; i < preferences.length; i++) {
            const currentPref = preferences[i];
            
            // Query parameters optimized using strict dynamic indexed search to prevent memory loops crash
            let searchCriteria = {
                collegeCode: String(currentPref.collegeCode).trim(),
                category: { $regex: categoryRegex }
            };

            if (currentPref.branchCode && currentPref.branchCode.trim() !== "") {
                searchCriteria.branchCode = String(currentPref.branchCode).trim();
            }

            const matchingCutoffs = await database.collection('cutoffs')
                .find(searchCriteria)
                .toArray();

            if (matchingCutoffs.length > 0) {
                // Parse percentiles cleanly as real numerical comparisons
                matchingCutoffs.sort((a, b) => parseFloat(b.percentile) - parseFloat(a.percentile));
                
                const securedBranch = matchingCutoffs.find(c => userPercentile >= parseFloat(c.percentile));

                if (securedBranch) {
                    allottedUnit = {
                        preferenceNumber: i + 1,
                        collegeCode: currentPref.collegeCode,
                        collegeName: currentPref.collegeName,
                        branchName: securedBranch.branchName || currentPref.branchName || "Engineering Stream",
                        city: currentPref.city || "Maharashtra",
                        cutoffMatched: parseFloat(securedBranch.percentile),
                        round: securedBranch.round || 1
                    };
                    break; 
                }
            }
        }

        return res.status(200).json({ 
            success: true, 
            allocated: allottedUnit !== null, 
            data: allottedUnit 
        });
    } catch (error) {
        console.error("Simulation engine drop:", error);
        return res.status(500).json({ success: false, message: "Internal runtime breakdown" });
    }
});

module.exports = router;