const jwt = require("jsonwebtoken");
const authMiddleware = require("../authMiddleware");

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("authMiddleware", () => {
  test("no Authorization header → 401", () => {
    const req = { header: () => undefined };
    const res = mockRes();
    const next = jest.fn();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("malformed token → 401", () => {
    const req = { header: () => "Bearer not.a.real.token" };
    const res = mockRes();
    const next = jest.fn();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("valid token → sets req.user and calls next", () => {
    const token = jwt.sign({ userId: "u1", username: "aria" }, process.env.JWT_SECRET);
    const req = { header: () => `Bearer ${token}` };
    const res = mockRes();
    const next = jest.fn();
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ userId: "u1", username: "aria" });
  });
});
